const  sql  = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ==========================================
//              DROPDOWN DATA
// ==========================================
exports.getComponents = async (req, res) => {
  try {
    const result = await sql.query("SELECT code, description, pouredWeight FROM Component");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch components" });
  }
};

exports.getDelayReasons = async (req, res) => {
  try {
    const result = await sql.query`SELECT id, reasonName FROM DelaysReason ORDER BY reasonName`;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch delay reasons" });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const result = await sql.query("SELECT id, name FROM Employee");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch employees" });
  }
};

exports.getIncharges = async (req, res) => {
  try {
    const result = await sql.query("SELECT id, name FROM Incharge");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch incharges" });
  }
};

exports.getSupervisors = async (req, res) => {
  try {
    const result = await sql.query`SELECT id, supervisorName FROM Supervisors ORDER BY supervisorName`;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch supervisors" });
  }
};

exports.getOperators = async (req, res) => {
  try {
    const result = await sql.query`SELECT id, operatorName FROM Operators ORDER BY operatorName`;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch operators" });
  }
};

// ==========================================
//        FETCH LAST PERSONNEL FOR SHIFT
// ==========================================
exports.getLastPersonnel = async (req, res) => {
  const { disa, date, shift } = req.query;
  try {
    const result = await sql.query`
      SELECT TOP 1 incharge, member, ppOperator, supervisorName 
      FROM DisamaticProductReport 
      WHERE disa = ${disa} AND reportDate = ${date} AND shift = ${shift}
      ORDER BY id DESC
    `;
    res.json(result.recordset[0] || null);
  } catch (error) {
    console.error("Error fetching personnel:", error);
    res.status(500).json({ error: "Failed to fetch personnel" });
  }
};

// ==========================================
//            LAST MOULD COUNTER
// ==========================================
exports.getLastMouldCounter = async (req, res) => {
  const { disa } = req.query;
  try {
    const result = await sql.query`
      SELECT TOP 1 p.mouldCounterNo 
      FROM DisamaticProduction p
      JOIN DisamaticProductReport r ON p.reportId = r.id
      WHERE r.disa = ${disa}
      ORDER BY r.reportDate DESC, r.id DESC, p.mouldCounterNo DESC
    `;

    const lastMouldCounter = result.recordset[0]?.mouldCounterNo || 0;
    res.status(200).json({ lastMouldCounter });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch last mould counter" });
  }
};

// ==========================================
//            FORM SUBMISSION
// ==========================================
exports.createReport = async (req, res) => {
  const {
    disa, date, shift, incharge, member, 
    ppOperator, supervisorName, maintenance, significantEvent,
    productions = [], 
    nextShiftPlans = [], mouldHardness = [], patternTemps = [], delays = []
  } = req.body;

  try {
    const reportResult = await sql.query`
      INSERT INTO DisamaticProductReport (
        disa, reportDate, shift, incharge,
        member, ppOperator, supervisorName, maintenance, significantEvent
      )
      OUTPUT INSERTED.id
      VALUES (
        ${disa}, ${date}, ${shift}, ${incharge},
        ${member}, ${ppOperator || null}, ${supervisorName || null},
        ${maintenance || null}, ${significantEvent || null}
      )
    `;

    const reportId = reportResult.recordset[0].id;

    if (productions.length > 0) {
      
      const firstProduced = Number(productions[0].produced);
      
      await sql.query`
        WITH CTE AS (
          SELECT TOP 1 p.produced
          FROM DisamaticProduction p
          INNER JOIN DisamaticProductReport r ON p.reportId = r.id
          WHERE r.disa = ${disa}
          ORDER BY r.reportDate DESC, r.id DESC, p.id DESC
        )
        UPDATE CTE SET produced = ${firstProduced}
      `;

      for (let i = 0; i < productions.length; i++) {
        const p = productions[i];
        
        const producedValue = (i === productions.length - 1) 
          ? null 
          : Number(productions[i + 1].produced);

        await sql.query`
          INSERT INTO DisamaticProduction (
            reportId, componentName, mouldCounterNo, produced, poured,
            cycleTime, mouldsPerHour, remarks
          )
          VALUES (
            ${reportId}, ${p.componentName}, ${Number(p.mouldCounterNo)},
            ${producedValue}, ${Number(p.poured)},
            ${Number(p.cycleTime)}, ${Number(p.mouldsPerHour)},
            ${p.remarks || null}
          )
        `;
      }
    }

    if (delays.length > 0) {
      for (let d of delays) {
        const durationTime = `${d.startTime} - ${d.endTime}`;
        await sql.query`
          INSERT INTO DisamaticDelays (
            reportId, delay, durationMinutes, durationTime
          )
          VALUES (
            ${reportId}, ${d.delayType}, ${Number(d.duration)}, ${durationTime}
          )
        `;
      }
    }

    const shiftOrder = ["I", "II", "III"];
    let currentShiftIndex = shiftOrder.indexOf(shift);
    let planDate = new Date(date);

    for (let i = 0; i < nextShiftPlans.length; i++) {
      currentShiftIndex++;
      if (currentShiftIndex >= shiftOrder.length) {
        currentShiftIndex = 0;
        planDate.setDate(planDate.getDate() + 1);
      }
      const planShift = shiftOrder[currentShiftIndex];
      const formattedPlanDate = planDate.toISOString().split("T")[0];
      const plan = nextShiftPlans[i];

      await sql.query`
        INSERT INTO DisamaticNextShiftPlan (
          reportId, planDate, planShift, componentName, plannedMoulds, remarks
        )
        VALUES (
          ${reportId}, ${formattedPlanDate}, ${planShift}, 
          ${plan.componentName}, ${Number(plan.plannedMoulds)}, ${plan.remarks || null}
        )
      `;
    }

    for (let i = 0; i < mouldHardness.length; i++) {
      const h = mouldHardness[i];
      await sql.query`
        INSERT INTO DisamaticMouldHardness (
          reportId, componentName, penetrationPP, penetrationSP, bScalePP, bScaleSP, remarks
        )
        VALUES (
          ${reportId}, ${h.componentName}, 
          ${Number(h.penetrationPP)}, ${Number(h.penetrationSP)}, 
          ${Number(h.bScalePP)}, ${Number(h.bScaleSP)}, 
          ${h.remarks || null}
        )
      `;
    }

    for (let i = 0; i < patternTemps.length; i++) {
      const pt = patternTemps[i];
      await sql.query`
        INSERT INTO DisamaticPatternTemp (
          reportId, componentName, pp, sp, remarks
        )
        VALUES (
          ${reportId}, ${pt.componentName}, 
          ${Number(pt.pp)}, ${Number(pt.sp)}, 
          ${pt.remarks || null}
        )
      `;
    }

    res.status(201).json({ message: "Report saved successfully" });

  } catch (error) {
    console.error("Error saving report:", error);
    res.status(500).json({ error: "Failed to save report", details: error.message });
  }
};

// ==========================================
//           DOWNLOAD PDF REPORT 
// ==========================================
exports.downloadAllReports = async (req, res) => {
  try {
    const reportResult = await sql.query`
      SELECT * FROM DisamaticProductReport 
      ORDER BY reportDate DESC, shift ASC, disa ASC, id ASC
    `;
    const reports = reportResult.recordset;

    if (reports.length === 0) {
      return res.status(404).json({ message: "No reports found" });
    }

    const grouped = {};
    reports.forEach(r => {
      const dateStr = new Date(r.reportDate).toISOString().split('T')[0];
      const key = `${dateStr}_${r.shift}_${r.disa}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          date: r.reportDate,
          shift: r.shift,
          disa: r.disa,
          incharge: r.incharge,
          member: r.member,
          ppOperator: r.ppOperator,
          supervisorName: r.supervisorName,
          reportIds: [],
          sigEvents: new Set(),
          maintenances: new Set()
        };
      }
      
      grouped[key].reportIds.push(r.id);
      grouped[key].incharge = r.incharge || grouped[key].incharge;
      grouped[key].member = r.member || grouped[key].member;
      grouped[key].ppOperator = r.ppOperator || grouped[key].ppOperator;
      grouped[key].supervisorName = r.supervisorName || grouped[key].supervisorName;
      
      if (r.significantEvent && r.significantEvent.trim()) grouped[key].sigEvents.add(r.significantEvent);
      if (r.maintenance && r.maintenance.trim()) grouped[key].maintenances.add(r.maintenance);
    });

    const reportGroups = Object.values(grouped);

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Disamatic_Report_Full.pdf"`);
    doc.pipe(res);

    const startX = 30;
    const pageBottom = 780; 
    const tableWidth = 535;

    const checkPageBreak = (neededHeight) => {
      if (doc.y + neededHeight > pageBottom) {
        doc.addPage();
        return true; 
      }
      return false;
    };

    // ⬇️ MODIFIED: Centered and "Darkly" hyphen logic added ⬇️
    const drawCellText = (text, x, y, w, h, align = 'center', font = 'Helvetica', fontSize = 9) => {
      const content = (text !== null && text !== undefined && text !== "") ? text.toString() : "-";
      
      // If it is a hyphen, force center alignment and bold (dark) font
      const finalAlign = (content === "-") ? 'center' : align;
      const finalFont = (content === "-") ? 'Helvetica-Bold' : font;

      doc.font(finalFont).fontSize(fontSize).fillColor('black');

      const innerWidth = w - 10; 
      const textHeight = doc.heightOfString(content, { width: innerWidth });
      const topPad = h > textHeight ? (h - textHeight) / 2 : 5; 
      
      doc.text(content, x + 5, y + topPad, { 
        width: innerWidth, 
        align: finalAlign,
      });
    };

    for (let i = 0; i < reportGroups.length; i++) {
      const g = reportGroups[i];
      if (i > 0) doc.addPage(); 

      // --- HEADER WITH LOGO ---
      let currentY = 30;
      doc.rect(startX, currentY, tableWidth, 60).stroke();
      
      // ⬇️ NEW: Add the Logo Image to the left cell if it exists
      const logoPath = path.join(__dirname, '../assets/logo.png');
      if (fs.existsSync(logoPath)) {
        // Fits the logo nicely in the 120x40px area
        doc.image(logoPath, startX + 5, currentY + 10, { fit: [120, 40], align: 'center', valign: 'center' });
      } else {
        // Fallback text if logo is missing
        doc.font('Helvetica-Bold').fontSize(16).text("SAKTHI AUTO", startX + 10, currentY + 22, { width: 120, align: 'center' });
      }

      doc.moveTo(startX + 130, currentY).lineTo(startX + 130, currentY + 60).stroke();
      
      doc.font('Helvetica-Bold').fontSize(11).text(`DISAMATIC PRODUCTION REPORT`, startX + 130, currentY + 18, { width: 270, align: 'center' });
      doc.fontSize(11).text(`DISA - ${g.disa}`, startX + 130, currentY + 35, { width: 270, align: 'center' });

      const metaX = 400;
      doc.rect(metaX, currentY, tableWidth - 370, 60).stroke();
      doc.fontSize(9).font('Helvetica');
      doc.text(`Date      : ${new Date(g.date).toLocaleDateString('en-GB')}`, metaX + 5, currentY + 8);
      doc.moveTo(metaX, currentY + 20).lineTo(startX + tableWidth, currentY + 20).stroke();
      doc.text(`Shift      : ${g.shift}`, metaX + 5, currentY + 28);
      doc.moveTo(metaX, currentY + 40).lineTo(startX + tableWidth, currentY + 40).stroke();
      doc.text(`Incharge: ${g.incharge || "-"}`, metaX + 5, currentY + 48);
      currentY += 60; 

      doc.rect(startX, currentY, tableWidth, 25).stroke();
      doc.font('Helvetica-Bold').text("Member Present:", startX + 5, currentY + 8);
      doc.font('Helvetica').text(g.member || "-", startX + 90, currentY + 8);
      doc.font('Helvetica-Bold').text("P/P Operator:", startX + 350, currentY + 8);
      doc.font('Helvetica').text(g.ppOperator || "-", startX + 420, currentY + 8);
      currentY += 25;

      const idsList = g.reportIds.join(',');

      const drawDynamicTable = async (title, columns, dataQuery, totalConfig = null) => {
        const result = await sql.query(dataQuery);
        const data = result.recordset;

        if (checkPageBreak(50)) currentY = 50;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text(title, startX, currentY + 8);
        currentY += 22;

        const headerHeight = 25;
        let xPos = startX;
        doc.rect(startX, currentY, tableWidth, headerHeight).fillColor('#f3f4f6').stroke();
        doc.fillColor('black'); 

        columns.forEach(col => {
          drawCellText(col.label, xPos, currentY - 2, col.w, headerHeight, 'center', 'Helvetica-Bold', 8);
          doc.moveTo(xPos + col.w, currentY).lineTo(xPos + col.w, currentY + headerHeight).stroke();
          xPos += col.w;
        });
        doc.rect(startX, currentY, tableWidth, headerHeight).stroke();
        currentY += headerHeight;

        if (data.length === 0) {
          doc.rect(startX, currentY, tableWidth, 20).stroke();
          drawCellText("-", startX, currentY, tableWidth, 20);
          currentY += 20;
        } else {
          data.forEach((row, idx) => {
            const sno = idx + 1;
            let maxH = 20; 
            
            doc.font('Helvetica').fontSize(9);
            columns.forEach(col => {
              const val = col.key === 'sno' ? sno.toString() : (row[col.key] || "-").toString();
              const textH = doc.heightOfString(val, { width: col.w - 10 }); 
              if (textH + 12 > maxH) maxH = textH + 12;
            });

            if (checkPageBreak(maxH)) currentY = 50;

            let rX = startX;
            columns.forEach(col => {
              const val = col.key === 'sno' ? sno : row[col.key];
              drawCellText(val, rX, currentY, col.w, maxH, col.align || 'center');
              doc.rect(rX, currentY, col.w, maxH).stroke();
              rX += col.w;
            });
            currentY += maxH;
          });

          // Draw Total Row if requested
          if (totalConfig) {
            let totals = {};
            totalConfig.sumCols.forEach(k => totals[k] = 0);
            
            let totalTonnage = 0;

            data.forEach(r => {
              totalConfig.sumCols.forEach(k => {
                let val = Number(r[k]);
                if (!isNaN(val)) totals[k] += val;
              });

              if (totalConfig.calcTonnage) {
                const poured = Number(r.poured) || 0;
                const weight = Number(r.pouredWeight) || 0;
                totalTonnage += (poured * weight);
              }
            });

            if (checkPageBreak(20)) currentY = 50;

            let rX = startX;
            doc.font('Helvetica-Bold').fontSize(9);
            columns.forEach(col => {
              let cellText = " "; 
              let align = 'center';
              
              if (col.key === totalConfig.labelCol) {
                cellText = totalConfig.labelText;
                align = 'right';
              } else if (totalConfig.sumCols.includes(col.key)) {
                cellText = totals[col.key].toString();
              } else if (totalConfig.calcTonnage && col.key === 'remarks') {
                cellText = `Tonnage: ${totalTonnage > 0 ? (totalTonnage / 1000).toFixed(3) + ' t' : '-'}`; 
              }

              drawCellText(cellText, rX, currentY, col.w, 20, align, 'Helvetica-Bold');
              doc.rect(rX, currentY, col.w, 20).stroke();
              rX += col.w;
            });
            currentY += 20;
          }
        }
      };

      // 1. Production Table
      await drawDynamicTable("Production :", [
        { label: "Mould Counter", key: "mouldCounterNo", w: 75 },
        { label: "Component Name", key: "componentName", w: 140, align: 'left' },
        { label: "Produced", key: "produced", w: 50 },
        { label: "Poured", key: "poured", w: 50 },
        { label: "Cycle Time", key: "cycleTime", w: 45 },
        { label: "Moulds/Hr", key: "mouldsPerHour", w: 45 },
        { label: "Remarks", key: "remarks", w: 130, align: 'left' }
      ], `
        SELECT p.*, c.pouredWeight 
        FROM DisamaticProduction p 
        LEFT JOIN Component c ON p.componentName = c.description
        WHERE p.reportId IN (${idsList}) 
        ORDER BY p.id ASC
      `, 
      { labelCol: 'componentName', labelText: 'Total : ', sumCols: ['produced', 'poured'], calcTonnage: true });

      // 2. Next Shift Plan
      await drawDynamicTable("Next Shift Plan :", [
        { label: "S.No", key: "sno", w: 30 },
        { label: "Component Name", key: "componentName", w: 220, align: 'left' },
        { label: "Planned Moulds", key: "plannedMoulds", w: 100 },
        { label: "Remarks", key: "remarks", w: 185, align: 'left' }
      ], `SELECT * FROM DisamaticNextShiftPlan WHERE reportId IN (${idsList}) ORDER BY id ASC`);

      // 3. Delays
      await drawDynamicTable("Delays :", [
        { label: "S.No", key: "sno", w: 30 },
        { label: "Delays (Reason)", key: "delay", w: 240, align: 'left' },
        { label: "Minutes", key: "durationMinutes", w: 100 },
        { label: "Time Range", key: "durationTime", w: 165 }
      ], `SELECT * FROM DisamaticDelays WHERE reportId IN (${idsList}) ORDER BY id ASC`,
      { labelCol: 'delay', labelText: 'Total Minutes : ', sumCols: ['durationMinutes'] });

      if (checkPageBreak(80)) currentY = 50;
      doc.font('Helvetica-Bold').fontSize(10).text("Mould Hardness :", startX, currentY + 8);
      currentY += 22;

      const hardResult = await sql.query(`SELECT * FROM DisamaticMouldHardness WHERE reportId IN (${idsList}) ORDER BY id ASC`);
      const hData = hardResult.recordset;

      doc.rect(startX, currentY, tableWidth, 30).fillColor('#f3f4f6').stroke();
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8);
      
      drawCellText("S.No", startX, currentY, 30, 30); doc.rect(startX, currentY, 30, 30).stroke();
      drawCellText("Component Name", startX + 30, currentY, 120, 30); doc.rect(startX + 30, currentY, 120, 30).stroke();
      
      doc.rect(startX + 150, currentY, 90, 15).stroke();
      drawCellText("Mould Penetration", startX + 150, currentY, 90, 15, 'center', 'Helvetica-Bold', 7);
      drawCellText("PP", startX + 150, currentY + 15, 45, 15); doc.rect(startX + 150, currentY + 15, 45, 15).stroke();
      drawCellText("SP", startX + 195, currentY + 15, 45, 15); doc.rect(startX + 195, currentY + 15, 45, 15).stroke();

      doc.rect(startX + 240, currentY, 90, 15).stroke();
      drawCellText("B - Scale", startX + 240, currentY, 90, 15);
      drawCellText("PP", startX + 240, currentY + 15, 45, 15); doc.rect(startX + 240, currentY + 15, 45, 15).stroke();
      drawCellText("SP", startX + 285, currentY + 15, 45, 15); doc.rect(startX + 285, currentY + 15, 45, 15).stroke();

      drawCellText("Remarks", startX + 330, currentY, 205, 30); doc.rect(startX + 330, currentY, 205, 30).stroke();
      currentY += 30;

      if (hData.length === 0) {
        doc.rect(startX, currentY, tableWidth, 20).stroke();
        drawCellText("-", startX, currentY, tableWidth, 20);
        currentY += 20;
      } else {
        hData.forEach((m, idx) => {
          let maxH = 20;
          doc.font('Helvetica').fontSize(9);
          let cnH = doc.heightOfString(m.componentName || "-", { width: 110 });
          let remH = doc.heightOfString(m.remarks || "-", { width: 195 });
          maxH = Math.max(20, cnH + 12, remH + 12);

          if (checkPageBreak(maxH)) currentY = 50;

          let x = startX;
          drawCellText(idx + 1, x, currentY, 30, maxH); doc.rect(x, currentY, 30, maxH).stroke(); x += 30;
          drawCellText(m.componentName, x, currentY, 120, maxH, 'left'); doc.rect(x, currentY, 120, maxH).stroke(); x += 120;
          drawCellText(m.penetrationPP, x, currentY, 45, maxH); doc.rect(x, currentY, 45, maxH).stroke(); x += 45;
          drawCellText(m.penetrationSP, x, currentY, 45, maxH); doc.rect(x, currentY, 45, maxH).stroke(); x += 45;
          drawCellText(m.bScalePP, x, currentY, 45, maxH); doc.rect(x, currentY, 45, maxH).stroke(); x += 45;
          drawCellText(m.bScaleSP, x, currentY, 45, maxH); doc.rect(x, currentY, 45, maxH).stroke(); x += 45;
          drawCellText(m.remarks, x, currentY, 205, maxH, 'left'); doc.rect(x, currentY, 205, maxH).stroke();
          currentY += maxH;
        });
      }

      const ptResult = await sql.query(`SELECT * FROM DisamaticPatternTemp WHERE reportId IN (${idsList}) ORDER BY id ASC`);
      const ptData = ptResult.recordset;
      
      const sigEventText = Array.from(g.sigEvents).join(' | ') || "-";
      doc.font('Helvetica').fontSize(9);
      const sigH = doc.heightOfString(sigEventText, { width: 240 }) + 35; 

      let ptTableHeight = 15;
      let ptRowHeights = [];

      if (ptData.length === 0) {
        ptTableHeight += 20;
        ptRowHeights.push(20);
      } else {
        ptData.forEach(pt => {
          let h = 20;
          doc.font('Helvetica').fontSize(9);
          let cnH = doc.heightOfString(pt.componentName || "-", { width: 140 }); 
          if (cnH + 12 > h) h = cnH + 12;
          ptTableHeight += h;
          ptRowHeights.push(h);
        });
      }

      const splitBlockH = Math.max(sigH, ptTableHeight, 50);

      if (checkPageBreak(splitBlockH + 40)) currentY = 50;

      doc.rect(startX, currentY, tableWidth, 15).fillColor('#f3f4f6').stroke();
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8);
      doc.text("Pattern Temp. in C°", startX + 5, currentY + 4);
      doc.text("Significant Event :", startX + 285, currentY + 4);
      
      doc.moveTo(startX + 280, currentY).lineTo(startX + 280, currentY + splitBlockH + 15).stroke();
      
      currentY += 15;
      const blockStartY = currentY;

      drawCellText("S.No", startX, currentY, 30, 15, 'center', 'Helvetica-Bold', 7); doc.rect(startX, currentY, 30, 15).stroke();
      drawCellText("ITEMS", startX + 30, currentY, 150, 15, 'center', 'Helvetica-Bold', 7); doc.rect(startX + 30, currentY, 150, 15).stroke();
      drawCellText("PP", startX + 180, currentY, 50, 15, 'center', 'Helvetica-Bold', 7); doc.rect(startX + 180, currentY, 50, 15).stroke();
      drawCellText("SP", startX + 230, currentY, 50, 15, 'center', 'Helvetica-Bold', 7); doc.rect(startX + 230, currentY, 50, 15).stroke();
      currentY += 15;

      if (ptData.length === 0) {
          drawCellText("-", startX, currentY, 30, 20); doc.rect(startX, currentY, 30, 20).stroke();
          drawCellText("-", startX + 30, currentY, 150, 20); doc.rect(startX + 30, currentY, 150, 20).stroke();
          drawCellText("-", startX + 180, currentY, 50, 20); doc.rect(startX + 180, currentY, 50, 20).stroke();
          drawCellText("-", startX + 230, currentY, 50, 20); doc.rect(startX + 230, currentY, 50, 20).stroke();
          currentY += 20;
      } else {
          ptData.forEach((pt, j) => {
            let rH = ptRowHeights[j];
            drawCellText(j + 1, startX, currentY, 30, rH); doc.rect(startX, currentY, 30, rH).stroke();
            drawCellText(pt.componentName, startX + 30, currentY, 150, rH, 'left'); doc.rect(startX + 30, currentY, 150, rH).stroke();
            drawCellText(pt.pp, startX + 180, currentY, 50, rH); doc.rect(startX + 180, currentY, 50, rH).stroke();
            drawCellText(pt.sp, startX + 230, currentY, 50, rH); doc.rect(startX + 230, currentY, 50, rH).stroke();
            currentY += rH;
          });
      }

      if (currentY < blockStartY + splitBlockH) {
          let diff = (blockStartY + splitBlockH) - currentY;
          doc.rect(startX, currentY, 30, diff).stroke();
          doc.rect(startX + 30, currentY, 150, diff).stroke();
          doc.rect(startX + 180, currentY, 50, diff).stroke();
          doc.rect(startX + 230, currentY, 50, diff).stroke();
      }

      doc.font('Helvetica').fontSize(9).text(sigEventText, startX + 285, blockStartY + 5, { width: 245 });
      doc.rect(startX + 280, blockStartY, 255, splitBlockH).stroke();
      
      currentY = blockStartY + splitBlockH;

      const maintText = Array.from(g.maintenances).join(' | ') || "-";
      doc.rect(startX, currentY, tableWidth, 40).stroke();
      doc.font('Helvetica-Bold').fontSize(8).text("Maintenance :", startX + 5, currentY + 5);
      doc.font('Helvetica').fontSize(9).text(maintText, startX + 5, currentY + 15, { width: tableWidth - 10 });
      currentY += 40;

      doc.rect(startX, currentY, tableWidth, 20).stroke();
      doc.font('Helvetica-Bold').text(`Supervisor Name : ${g.supervisorName || "-"}`, startX + 330, currentY + 5);
      doc.fontSize(7).font('Helvetica').text("QF/07/FBP-03, Rev.No: 02 dt 01.10.2024", startX, currentY + 25);
    }
    
    doc.end();

  } catch (error) {
    console.error("PDF Generation Error:", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
};