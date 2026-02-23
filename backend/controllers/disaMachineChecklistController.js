
const  sql  = require('../db');

// --- 1. Get Details (Filter by Date AND Machine) ---
exports.getChecklistDetails = async (req, res) => {
  try {
    const { date, disaMachine } = req.query;
    
    const checklistResult = await sql.query`
      SELECT 
          M.MasterId, 
          M.SlNo, 
          M.CheckPointDesc, 
          M.CheckMethod, 
          ISNULL(T.IsDone, 0) as IsDone, 
          ISNULL(T.IsHoliday, 0) as IsHoliday,
          ISNULL(T.IsVatCleaning, 0) as IsVatCleaning,
          ISNULL(T.ReadingValue, '') as ReadingValue,
          T.Sign
      FROM MachineChecklist_Master M
      LEFT JOIN MachineChecklist_Trans T 
          ON M.MasterId = T.MasterId 
          AND T.LogDate = ${date}
          AND T.DisaMachine = ${disaMachine}
      ORDER BY M.SlNo ASC
    `;
    
    const operatorsResult = await sql.query`SELECT Id, OperatorName FROM dbo.Operators`;
    
    const reportsResult = await sql.query`
      SELECT * FROM dbo.DisaNonConformanceReport 
      WHERE ReportDate = ${date} AND DisaMachine = ${disaMachine}
    `;

    res.json({
      checklist: checklistResult.recordset,
      operators: operatorsResult.recordset,
      reports: reportsResult.recordset 
    });

  } catch (err) {
    console.error('Error fetching details:', err);
    res.status(500).send(err.message);
  }
};

// --- 2. Batch Submit (Transactions) ---
exports.saveBatchChecklist = async (req, res) => {
  try {
    const { items, sign, date, disaMachine } = req.body; 
    if (!items || !date || !disaMachine) return res.status(400).send("Data missing");

    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      for (const item of items) {
        const request = new sql.Request(transaction); 

        const checkRes = await request.query`
            SELECT COUNT(*) as count FROM MachineChecklist_Trans 
            WHERE MasterId = ${item.MasterId} AND LogDate = ${date} AND DisaMachine = ${disaMachine}
        `;
        
        const isDoneVal = item.IsDone ? 1 : 0;
        const isHolidayVal = item.IsHoliday ? 1 : 0;
        const isVatVal = item.IsVatCleaning ? 1 : 0; // ✅ Add VAT Flag
        const readingVal = item.ReadingValue || ''; 

        const writeRequest = new sql.Request(transaction);

        if (checkRes.recordset[0].count > 0) {
          // UPDATE
          await writeRequest.query`
            UPDATE MachineChecklist_Trans 
            SET IsDone = ${isDoneVal}, IsHoliday = ${isHolidayVal}, IsVatCleaning = ${isVatVal}, ReadingValue = ${readingVal}, Sign = ${sign}, LastUpdated = GETDATE()
            WHERE MasterId = ${item.MasterId} AND LogDate = ${date} AND DisaMachine = ${disaMachine}
          `;
        } else {
          // INSERT
          await writeRequest.query`
            INSERT INTO MachineChecklist_Trans (MasterId, LogDate, IsDone, IsHoliday, IsVatCleaning, ReadingValue, Sign, DisaMachine)
            VALUES (${item.MasterId}, ${date}, ${isDoneVal}, ${isHolidayVal}, ${isVatVal}, ${readingVal}, ${sign}, ${disaMachine})
          `;
        }
      }
      
      await transaction.commit();
      res.json({ success: true });

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Error saving batch:', err);
    res.status(500).send(err.message);
  }
};

// --- 3. Save NC Report ---
exports.saveNCReport = async (req, res) => {
  try {
    const { 
        checklistId, slNo, reportDate, ncDetails, correction, 
        rootCause, correctiveAction, targetDate, responsibility, sign, disaMachine 
    } = req.body;

    await sql.query`
      INSERT INTO DisaNonConformanceReport (
        MasterId, ReportDate, NonConformityDetails, Correction, 
        RootCause, CorrectiveAction, TargetDate, Responsibility, 
        Sign, Status, DisaMachine
      )
      VALUES (
        ${checklistId}, ${reportDate}, ${ncDetails}, ${correction}, 
        ${rootCause}, ${correctiveAction}, ${targetDate}, ${responsibility}, 
        ${sign}, 'Pending', ${disaMachine}
      )
    `;

    const checkRow = await sql.query`
        SELECT COUNT(*) as count FROM MachineChecklist_Trans 
        WHERE MasterId = ${checklistId} AND LogDate = ${reportDate} AND DisaMachine = ${disaMachine}
    `;
    
    if (checkRow.recordset[0].count > 0) {
       await sql.query`
           UPDATE MachineChecklist_Trans SET IsDone = 0, Sign = ${sign} 
           WHERE MasterId = ${checklistId} AND LogDate = ${reportDate} AND DisaMachine = ${disaMachine}
       `;
    } else {
       await sql.query`
           INSERT INTO MachineChecklist_Trans (MasterId, LogDate, IsDone, Sign, DisaMachine) 
           VALUES (${checklistId}, ${reportDate}, 0, ${sign}, ${disaMachine})
       `;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// --- 4. Monthly Report ---
exports.getMonthlyReport = async (req, res) => {
  try {
    const { month, year, disaMachine } = req.query;
    
    // ✅ Add IsVatCleaning to PDF Fetch
    const checklistResult = await sql.query`
      SELECT MasterId, DAY(LogDate) as DayVal, IsDone, IsHoliday, IsVatCleaning, ReadingValue, Sign
      FROM MachineChecklist_Trans
      WHERE MONTH(LogDate) = ${month} 
        AND YEAR(LogDate) = ${year} 
        AND DisaMachine = ${disaMachine}
    `;

    const ncResult = await sql.query`
      SELECT 
        ReportId, ReportDate, NonConformityDetails, 
        Correction, RootCause, CorrectiveAction, 
        TargetDate, Responsibility, Sign, Status
      FROM DisaNonConformanceReport
      WHERE MONTH(ReportDate) = ${month} 
        AND YEAR(ReportDate) = ${year} 
        AND DisaMachine = ${disaMachine}
      ORDER BY ReportDate ASC
    `;

    res.json({ 
      monthlyLogs: checklistResult.recordset,
      ncReports: ncResult.recordset
    });

  } catch (err) {
    console.error("Monthly Report Error:", err);
    res.status(500).send(err.message);
  }
};
