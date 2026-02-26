const sql = require('../db');

// --- Operator Fetch ---
exports.getDetails = async (req, res) => {
  try {
    const { date, disa } = req.query;

    const operatorsRes = await sql.query`SELECT username AS OperatorName FROM dbo.Users WHERE role = 'operator' ORDER BY username`;
    const supervisorsRes = await sql.query`SELECT username AS supervisorName FROM dbo.Users WHERE role = 'supervisor' ORDER BY username`;

    const recordsRes = await sql.query`
      SELECT * FROM DmmSettingParameters 
      WHERE RecordDate = ${date} AND DisaMachine = ${disa}
      ORDER BY Shift ASC, RowIndex ASC
    `;

    const shiftsData = { 1: [], 2: [], 3: [] };
    const shiftsMeta = { 
        1: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false }, 
        2: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false }, 
        3: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false } 
    };

    recordsRes.recordset.forEach(row => {
        shiftsData[row.Shift].push(row);
        shiftsMeta[row.Shift] = { 
            operator: row.OperatorName || '', 
            supervisor: row.SupervisorName || '',
            supervisorSignature: row.SupervisorSignature || '',
            isIdle: row.IsIdle === true || row.IsIdle === 1
        };
    });

    res.json({
      operators: operatorsRes.recordset,
      supervisors: supervisorsRes.recordset,
      shiftsData,
      shiftsMeta
    });
  } catch (err) { res.status(500).send('Server Error'); }
};

// --- Operator Save ---
exports.saveDetails = async (req, res) => {
  try {
    const { date, disa, shiftsData, shiftsMeta } = req.body;
    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      const deleteReq = new sql.Request(transaction);
      await deleteReq.query`DELETE FROM DmmSettingParameters WHERE RecordDate = ${date} AND DisaMachine = ${disa}`;

      for (const shift of [1, 2, 3]) {
          const rows = shiftsData[shift] || [];
          const meta = shiftsMeta[shift] || { operator: '', supervisor: '', isIdle: false };
          const isIdleVal = meta.isIdle ? 1 : 0;
          const rowsToSave = rows.length > 0 ? rows : [{}]; 

          for (let i = 0; i < rowsToSave.length; i++) {
              const row = rowsToSave[i];
              const insertReq = new sql.Request(transaction); 
              await insertReq.query`
                INSERT INTO DmmSettingParameters (
                    RecordDate, DisaMachine, Shift, OperatorName, SupervisorName, IsIdle, RowIndex,
                    Customer, ItemDescription, Time, PpThickness, PpHeight, SpThickness, SpHeight,
                    CoreMaskOut, CoreMaskIn, SandShotPressure, CorrectionShotTime, SqueezePressure,
                    PpStripAccel, PpStripDist, SpStripAccel, SpStripDist, MouldThickness, CloseUpForce, Remarks
                ) VALUES (
                    ${date}, ${disa}, ${shift}, ${meta.operator}, ${meta.supervisor}, ${isIdleVal}, ${i},
                    ${row.Customer || ''}, ${row.ItemDescription || ''}, ${row.Time || ''}, 
                    ${row.PpThickness || ''}, ${row.PpHeight || ''}, ${row.SpThickness || ''}, ${row.SpHeight || ''},
                    ${row.CoreMaskOut || ''}, ${row.CoreMaskIn || ''}, ${row.SandShotPressure || ''}, 
                    ${row.CorrectionShotTime || ''}, ${row.SqueezePressure || ''},
                    ${row.PpStripAccel || ''}, ${row.PpStripDist || ''}, ${row.SpStripAccel || ''}, 
                    ${row.SpStripDist || ''}, ${row.MouldThickness || ''}, ${row.CloseUpForce || ''}, ${row.Remarks || ''}
                )
              `;
          }
      }
      await transaction.commit();
      res.json({ success: true, message: 'Settings saved successfully' });
    } catch (err) { await transaction.rollback(); res.status(500).send('Database Transaction Error'); }
  } catch (err) { res.status(500).send('Server Error'); }
};

// --- Supervisor Fetch ---
exports.getSupervisorReports = async (req, res) => {
  try {
    const { name } = req.params;
    // Groups reports by Date, Machine, and Shift so supervisors sign off shift-by-shift
    const records = await sql.query`
      SELECT RecordDate as reportDate, DisaMachine as disa, Shift as shift, OperatorName, SupervisorSignature 
      FROM DmmSettingParameters
      WHERE SupervisorName = ${name}
      GROUP BY RecordDate, DisaMachine, Shift, OperatorName, SupervisorSignature
      ORDER BY RecordDate DESC, Shift ASC
    `;
    res.json(records.recordset);
  } catch (err) { res.status(500).send('Failed to fetch reports'); }
};

// --- Supervisor Sign ---
exports.signSupervisorReport = async (req, res) => {
  try {
    const { date, disaMachine, shift, signature } = req.body;
    await sql.query`
      UPDATE DmmSettingParameters 
      SET SupervisorSignature = ${signature} 
      WHERE RecordDate = ${date} AND DisaMachine = ${disaMachine} AND Shift = ${shift}
    `;
    res.json({ success: true, message: 'Signed successfully' });
  } catch (err) { res.status(500).send('Failed to sign report'); }
};