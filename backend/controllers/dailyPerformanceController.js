const  sql  = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ==========================================
//   SUBMIT DAILY PRODUCTION PERFORMANCE
// ==========================================
// ==========================================
//   SUBMIT DAILY PRODUCTION PERFORMANCE
// ==========================================
exports.createDailyPerformance = async (req, res) => {
    // Destructure 'delays' from the body
    const { productionDate, disa, summary, details, unplannedReasons, signatures, delays } = req.body;

    try {
        // 1. Insert Main Report
        const reportResult = await sql.query`
            INSERT INTO DailyPerformanceReport (productionDate, disa, unplannedReasons, incharge, hof, hod)
            OUTPUT INSERTED.id
            VALUES (${productionDate}, ${disa}, ${unplannedReasons || null}, 
                    ${signatures.incharge || null}, ${signatures.hof || null}, ${signatures.hod || null})`;

        const reportId = reportResult.recordset[0].id;

        // 2. Insert Summary Data
        const shifts = ["I", "II", "III"];
        for (let shift of shifts) {
            const sData = summary[shift];
            await sql.query`
                INSERT INTO DailyPerformanceSummary (reportId, shiftName, pouredMoulds, tonnage, casted, shiftValue)
                VALUES (${reportId}, ${shift}, ${Number(sData.pouredMoulds) || 0},
                        ${Number(sData.tonnage) || 0}, ${Number(sData.casted) || 0}, ${Number(sData.value) || 0})`;
        }

        // 3. Insert Details Data
        if (details && details.length > 0) {
            for (let d of details) {
                if (d.patternCode) { 
                    await sql.query`
                        INSERT INTO DailyPerformanceDetails (reportId, patternCode, itemDescription, planned, unplanned,
                                                           mouldsProd, mouldsPour, cavity, unitWeight, totalWeight)
                        VALUES (${reportId}, ${d.patternCode}, ${d.itemDescription}, 
                                ${Number(d.planned) || 0}, ${Number(d.unplanned) || 0},
                                ${Number(d.mouldsProd) || 0}, ${Number(d.mouldsPour) || 0}, 
                                ${Number(d.cavity) || 0}, ${Number(d.unitWeight) || 0}, ${Number(d.totalWeight) || 0})`;
                }
            }
        }

        // ⬇️ NEW: Insert Delays Data into the new Productiondelays table ⬇️
        if (delays && delays.length > 0) {
            for (let delay of delays) {
                await sql.query`
                    INSERT INTO Productiondelays (reportId, shift, duration, reason)
                    VALUES (${reportId}, ${delay.shift}, ${Number(delay.duration) || 0}, ${delay.reason})`;
            }
        }

        res.status(201).json({ message: "Daily Performance Report saved successfully" });
    } catch (error) {
        console.error("Error saving daily performance:", error);
        res.status(500).json({ error: "Failed to save daily performance" });
    }
};

// ==========================================
//   FETCH AGGREGATED SUMMARY BY DATE & DISA
// ==========================================
exports.getSummaryByDate = async (req, res) => {
  const { date, disa } = req.query; 
  
  try {
    const result = await sql.query`
      SELECT 
        r.shift,
        SUM(TRY_CAST(p.poured AS INT)) AS totalPouredMoulds,
        SUM(TRY_CAST(p.poured AS INT) * TRY_CAST(c.pouredWeight AS DECIMAL(10,3))) AS totalTonnageKg
      FROM DisamaticProductReport r
      JOIN DisamaticProduction p ON r.id = p.reportId
      LEFT JOIN Component c ON p.componentName = c.description
      WHERE CAST(r.reportDate AS DATE) = CAST(${date} AS DATE) 
        AND r.disa = ${disa}
      GROUP BY r.shift
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch summary calculations", details: error.message });
  }
};

// ==========================================
//   FETCH DELAYS BY DATE & DISA
// ==========================================
exports.getDelaysByDateAndDisa = async (req, res) => {
  const { date, disa } = req.query;
  
  try {
    const result = await sql.query`
      SELECT 
        r.shift,
        d.durationMinutes AS duration,
        d.delay AS reason
      FROM DisamaticProductReport r
      JOIN DisamaticDelays d ON r.id = d.reportId
      WHERE CAST(r.reportDate AS DATE) = CAST(${date} AS DATE)
        AND r.disa = ${disa}
      ORDER BY r.shift, d.id
    `;

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching delays:", error);
    res.status(500).json({ error: "Failed to fetch delays", details: error.message });
  }
};


// ==========================================
//          DOWNLOAD PDF REPORT
// ==========================================
exports.downloadPDF = async (req, res) => {
  const { date, disa } = req.query;

  if (!date || !disa) {
    return res.status(400).json({ message: "Date and DISA are required to download the report." });
  }

  try {
    // 1. Fetch ALL Main Reports for this Date & DISA (Latest submission first)
    const reportQuery = await sql.query`
      SELECT * FROM DailyPerformanceReport 
      WHERE CAST(productionDate AS DATE) = CAST(${date} AS DATE) AND disa = ${disa}
      ORDER BY id DESC
    `;
    const reports = reportQuery.recordset;

    if (reports.length === 0) {
      return res.status(404).json({ message: "No report found for this Date and DISA. Please submit the form first." });
    }

    // 2. Fetch Delays Data (Delays are bound to the Date/DISA, not the specific report ID)
    const delaysQuery = await sql.query`
      SELECT r.shift, d.durationMinutes as duration, d.delay as reason
      FROM DisamaticProductReport r
      JOIN DisamaticDelays d ON r.id = d.reportId
      WHERE CAST(r.reportDate AS DATE) = CAST(${date} AS DATE) AND r.disa = ${disa}
      ORDER BY r.shift, d.id
    `;
    const delaysData = delaysQuery.recordset;

    // --- INITIALIZE PDF ---
    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Daily_Performance_${date}_${disa}.pdf"`);
    doc.pipe(res);

    const startX = 30;
    const tableWidth = 535;
    const pageBottom = 780; 
    let currentY = 30;

    // --- SMART PAGE BREAK CHECKER ---
    const checkPageBreak = (neededHeight) => {
      if (currentY + neededHeight > pageBottom) {
        doc.addPage();
        currentY = 30;
        return true; 
      }
      return false;
    };

    // --- RECTIFIED CELL DRAWING ---
    const drawCell = (text, x, y, w, h, align = 'center', font = 'Helvetica', size = 9, isBold = false) => {
      doc.rect(x, y, w, h).stroke();
      if (text === null || text === undefined) text = "";
      let content = text.toString().trim();
      if (content === "") content = "-";

      let finalFont = (content === "-") ? 'Helvetica-Bold' : (isBold ? 'Helvetica-Bold' : font);
      let currentSize = size;
      doc.font(finalFont).fontSize(currentSize);

      let innerWidth = w - 4;

      // Shrink font only if a single unbroken string is still larger than the cell
      let words = content.split(/[\s\n]+/);
      let maxWordWidth = Math.max(...words.map(word => doc.widthOfString(word)));
      while (maxWordWidth > innerWidth && currentSize > 5) {
        currentSize -= 0.5;
        doc.fontSize(currentSize);
        maxWordWidth = Math.max(...words.map(word => doc.widthOfString(word)));
      }

      const textHeight = doc.heightOfString(content, { width: innerWidth });
      const topPad = h > textHeight ? (h - textHeight) / 2 : 2;
      
      doc.fillColor('black').text(content, x + 2, y + topPad, { width: innerWidth, align: align });
    };

    // ==========================================
    //       LOOP THROUGH ALL REPORTS (DESC)
    // ==========================================
    for (let rIndex = 0; rIndex < reports.length; rIndex++) {
      const report = reports[rIndex];
      const reportId = report.id;

      const summaryData = (await sql.query`SELECT * FROM DailyPerformanceSummary WHERE reportId = ${reportId}`).recordset;
      const detailsData = (await sql.query`SELECT * FROM DailyPerformanceDetails WHERE reportId = ${reportId} ORDER BY id ASC`).recordset;

      if (rIndex > 0) {
        doc.addPage();
        currentY = 30;
      }

      // 1. HEADER
      doc.rect(startX, currentY, tableWidth, 40).stroke();
      const logoPath = path.join(__dirname, '../assets/logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 5, currentY + 5, { fit: [100, 30] });
      } else {
        doc.font('Helvetica-Bold').fontSize(12).text("SAKTHI AUTO\nCOMPONENT\nLIMITED", startX + 5, currentY + 5);
      }
      
      doc.moveTo(startX + 120, currentY).lineTo(startX + 120, currentY + 40).stroke();
      doc.font('Helvetica-Bold').fontSize(14).text("DAILY PRODUCTION PERFORMANCE (FOUNDRY - B)", startX + 120, currentY + 15, { width: 415, align: 'center' });
      currentY += 40;

      // DATE Row
      doc.rect(startX, currentY, tableWidth, 20).stroke();
      doc.font('Helvetica-Bold').fontSize(10).text(`DATE OF PRODUCTION : ${date.split('-').reverse().join('-')}           DISA: ${disa}`, startX + 5, currentY + 6);
      currentY += 20;

      // 2. SUMMARY TABLE
      const sumCols = [{ w: 60, l: 'SHIFT' }, { w: 115, l: 'POURED MOULDS' }, { w: 120, l: 'TONNAGE' }, { w: 120, l: 'CASTED' }, { w: 120, l: 'VALUE' }];
      let xHeaderPos = startX;
      sumCols.forEach(col => {
        drawCell(col.l, xHeaderPos, currentY, col.w, 20, 'center', 'Helvetica', 9, true);
        xHeaderPos += col.w;
      });
      currentY += 20;

      let tMoulds = 0, tTonnage = 0, tCasted = 0, tValue = 0;
      ["I", "II", "III"].forEach(shiftName => {
        const row = summaryData.find(s => s.shiftName === shiftName) || {};
        tMoulds += Number(row.pouredMoulds) || 0;
        tTonnage += Number(row.tonnage) || 0;
        tCasted += Number(row.casted) || 0;
        tValue += Number(row.shiftValue) || 0;

        let xPos = startX;
        drawCell(shiftName, xPos, currentY, sumCols[0].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[0].w;
        drawCell(row.pouredMoulds, xPos, currentY, sumCols[1].w, 20); xPos += sumCols[1].w;
        drawCell(row.tonnage ? Number(row.tonnage).toFixed(3) : "", xPos, currentY, sumCols[2].w, 20); xPos += sumCols[2].w;
        drawCell(row.casted ? Number(row.casted).toFixed(2) : "", xPos, currentY, sumCols[3].w, 20); xPos += sumCols[3].w;
        drawCell(row.shiftValue ? Number(row.shiftValue).toFixed(2) : "", xPos, currentY, sumCols[4].w, 20);
        currentY += 20;
      });

      let xPos = startX;
      drawCell("TOTAL", xPos, currentY, sumCols[0].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[0].w;
      drawCell(tMoulds || "", xPos, currentY, sumCols[1].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[1].w;
      drawCell(tTonnage > 0 ? tTonnage.toFixed(3) : "", xPos, currentY, sumCols[2].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[2].w;
      drawCell(tCasted > 0 ? tCasted.toFixed(2) : "", xPos, currentY, sumCols[3].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[3].w;
      drawCell(tValue > 0 ? tValue.toFixed(2) : "", xPos, currentY, sumCols[4].w, 20, 'center', 'Helvetica', 9, true);
      currentY += 30;

      // 3. DETAILS TABLE
      const detCols = [{ w: 25 }, { w: 90 }, { w: 100 }, { w: 35 }, { w: 35 }, { w: 45 }, { w: 45 }, { w: 25 }, { w: 135 }];

      const drawDetailsHeader = () => {
        checkPageBreak(50);
        let x = startX;
        drawCell("Sl.\nNo.", x, currentY, detCols[0].w, 30, 'center', 'Helvetica', 8, true); x += detCols[0].w;
        drawCell("Pattern Code", x, currentY, detCols[1].w, 30, 'center', 'Helvetica', 8, true); x += detCols[1].w;
        drawCell("Item Description", x, currentY, detCols[2].w, 30, 'center', 'Helvetica', 8, true); x += detCols[2].w;
        
        drawCell("Item", x, currentY, detCols[3].w + detCols[4].w, 15, 'center', 'Helvetica', 8, true); 
        drawCell("Planned", x, currentY + 15, detCols[3].w, 15, 'center', 'Helvetica', 6.5); 
        drawCell("Un\nPlanned", x + detCols[3].w, currentY + 15, detCols[4].w, 15, 'center', 'Helvetica', 6.5); 
        x += detCols[3].w + detCols[4].w;

        drawCell("Number of\nMoulds Prod.", x, currentY, detCols[5].w, 30, 'center', 'Helvetica', 7, true); x += detCols[5].w;
        drawCell("Number of\nMoulds Pour.", x, currentY, detCols[6].w, 30, 'center', 'Helvetica', 7, true); x += detCols[6].w;
        drawCell("No. of\nCavity", x, currentY, detCols[7].w, 30, 'center', 'Helvetica', 7, true); x += detCols[7].w;
        drawCell("Poured WT (Kg)", x, currentY, detCols[8].w, 30, 'center', 'Helvetica', 8, true);
        currentY += 30;
      };

      drawDetailsHeader();

      let detMouldsProd = 0, detMouldsPour = 0, detTotalWeight = 0;

      if (detailsData.length === 0) {
        doc.rect(startX, currentY, tableWidth, 20).stroke();
        drawCell("No production data recorded", startX, currentY, tableWidth, 20);
        currentY += 20;
      } else {
        detailsData.forEach((d, i) => {
          detMouldsProd += Number(d.mouldsProd) || 0;
          detMouldsPour += Number(d.mouldsPour) || 0;
          detTotalWeight += Number(d.totalWeight) || 0;

          let rawPattern = d.patternCode || "-";
          let safeDesc = d.itemDescription || "-";
          
          doc.fontSize(8);
          let innerPatW = detCols[1].w - 4;
          
          // ⬇️ PERFECT FIX FOR OVERFLOW: Programmatically wrap text exactly at the hyphen if it is too wide ⬇️
          let safePattern = rawPattern;
          if (rawPattern.includes('-') && !rawPattern.includes(' ')) {
            let parts = rawPattern.split('-');
            let lines = [];
            let currentLine = parts[0];
            for (let p = 1; p < parts.length; p++) {
              let testLine = currentLine + '-' + parts[p];
              if (doc.widthOfString(testLine) > innerPatW) {
                lines.push(currentLine + '-');
                currentLine = parts[p];
              } else {
                currentLine = testLine;
              }
            }
            lines.push(currentLine);
            safePattern = lines.join('\n'); // Force PDFKit to stack the text safely
          }

          let maxH = 20;
          let descH = doc.heightOfString(safeDesc, { width: detCols[2].w - 4 });
          let patH = doc.heightOfString(safePattern, { width: innerPatW });
          
          if (descH + 10 > maxH) maxH = descH + 10;
          if (patH + 10 > maxH) maxH = patH + 10;

          if (checkPageBreak(maxH)) {
            drawDetailsHeader(); 
          }

          let rowX = startX;
          drawCell(i + 1, rowX, currentY, detCols[0].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[0].w;
          drawCell(safePattern, rowX, currentY, detCols[1].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[1].w;
          drawCell(safeDesc, rowX, currentY, detCols[2].w, maxH, 'left', 'Helvetica', 8); rowX += detCols[2].w;
          drawCell(d.planned, rowX, currentY, detCols[3].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[3].w;
          drawCell(d.unplanned, rowX, currentY, detCols[4].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[4].w;
          drawCell(d.mouldsProd, rowX, currentY, detCols[5].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[5].w;
          drawCell(d.mouldsPour, rowX, currentY, detCols[6].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[6].w;
          drawCell(d.cavity, rowX, currentY, detCols[7].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[7].w;
          drawCell(d.totalWeight || "", rowX, currentY, detCols[8].w, maxH, 'center', 'Helvetica', 8); 
          currentY += maxH;
        });
      }

      // Details Total Row
      checkPageBreak(20);
      xPos = startX;
      const offsetW = detCols[0].w + detCols[1].w + detCols[2].w + detCols[3].w + detCols[4].w; 
      doc.rect(xPos, currentY, offsetW, 20).stroke();
      drawCell("TOTAL", xPos, currentY, offsetW, 20, 'center', 'Helvetica', 9, true); 
      xPos += offsetW;
      
      drawCell(detMouldsProd || "", xPos, currentY, detCols[5].w, 20, 'center', 'Helvetica', 9, true); xPos += detCols[5].w;
      drawCell(detMouldsPour || "", xPos, currentY, detCols[6].w, 20, 'center', 'Helvetica', 9, true); xPos += detCols[6].w;
      drawCell("", xPos, currentY, detCols[7].w, 20); xPos += detCols[7].w;
      drawCell(detTotalWeight > 0 ? Math.round(detTotalWeight) : "", xPos, currentY, detCols[8].w, 20, 'center', 'Helvetica', 9, true);
      currentY += 30; 

      // FOOTER REASONS & SIGNATURES
      checkPageBreak(80); 
      doc.rect(startX, currentY, tableWidth, 40).stroke();
      doc.font('Helvetica-Bold').fontSize(8).text("Reasons for producing un-planned items.", startX + 5, currentY + 5);
      doc.font('Helvetica').text(report.unplannedReasons || "-", startX + 5, currentY + 15, { width: tableWidth - 10 });
      currentY += 40;

      doc.rect(startX, currentY, tableWidth, 30).stroke();
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text(`In-charge: ${report.incharge || "-"}`, startX + 20, currentY + 15);
      doc.text(`HOF: ${report.hof || "-"}`, startX + 250, currentY + 15);
      doc.text(`HOD - Production: ${report.hod || "-"}`, startX + 400, currentY + 15);
      currentY += 30; 

          currentY += 15;
    checkPageBreak(20);
    doc.font('Helvetica').fontSize(8).fillColor('black');
    doc.text("QF/07/FBP-15, Rev.No:01 dt 10.06.2019", startX, currentY);
      // --- PAGE 2: DELAYS SECTION ---
      doc.addPage();
      currentY = 30;

      const delayCols = [{ w: 35, l: 'S.No.' }, { w: 60, l: 'Shift' }, { w: 100, l: 'Duration' }, { w: 340, l: 'Reasons' }];
      
      const drawDelaysHeader = () => {
        checkPageBreak(40);
        doc.rect(startX, currentY, tableWidth, 20).fillAndStroke('#e5e7eb', 'black');
        doc.fillColor('black').font('Helvetica-Bold').fontSize(10);
        doc.text("Production delays / Remarks", startX, currentY + 6, { width: tableWidth, align: 'center' });
        currentY += 20;

        let x = startX;
        delayCols.forEach(c => {
          drawCell(c.l, x, currentY, c.w, 20, 'center', 'Helvetica', 9, true);
          x += c.w;
        });
        currentY += 20;
      };

      drawDelaysHeader();

      if (delaysData.length === 0) {
        doc.rect(startX, currentY, tableWidth, 20).stroke();
        drawCell("-", startX, currentY, tableWidth, 20);
        currentY += 20;
      } else {
        delaysData.forEach((d, i) => {
          let maxH = 20;
          doc.fontSize(9);
          let rsnH = doc.heightOfString(d.reason || "-", { width: delayCols[3].w - 4 });
          if (rsnH + 10 > maxH) maxH = rsnH + 10;

          if (checkPageBreak(maxH)) {
            drawDelaysHeader();
          }

          let rX = startX;
          drawCell(i + 1, rX, currentY, delayCols[0].w, maxH); rX += delayCols[0].w;
          drawCell(d.shift || "", rX, currentY, delayCols[1].w, maxH); rX += delayCols[1].w;
          drawCell(d.duration || "", rX, currentY, delayCols[2].w, maxH); rX += delayCols[2].w;
          drawCell(d.reason || "", rX, currentY, delayCols[3].w, maxH, 'left');
          currentY += maxH;
        });
      }

      currentY += 15;
      checkPageBreak(20);
      doc.font('Helvetica').fontSize(8).fillColor('black');
      doc.text("QF/07/FBP-15, Rev.No:01 dt 10.06.2019", startX, currentY);

    } 

    doc.end();

  } catch (error) {
    console.error("PDF Generation Error:", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
};