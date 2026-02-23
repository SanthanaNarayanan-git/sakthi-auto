const  sql  = require('../db');

exports.getDetails = async (req, res) => {
  try {
    const { date, disa } = req.query;

    const operatorsRes = await sql.query`SELECT OperatorName FROM dbo.Operators`;
    const supervisorsRes = await sql.query`SELECT supervisorName FROM dbo.Supervisors`;

    const recordsRes = await sql.query`
      SELECT * FROM DmmSettingParameters 
      WHERE RecordDate = ${date} AND DisaMachine = ${disa}
      ORDER BY Shift ASC, RowIndex ASC
    `;

    const shiftsData = { 1: [], 2: [], 3: [] };
    const shiftsMeta = { 
        1: { operator: '', supervisor: '', isIdle: false }, 
        2: { operator: '', supervisor: '', isIdle: false }, 
        3: { operator: '', supervisor: '', isIdle: false } 
    };

    recordsRes.recordset.forEach(row => {
        shiftsData[row.Shift].push(row);
        shiftsMeta[row.Shift] = { 
            operator: row.OperatorName || '', 
            supervisor: row.SupervisorName || '',
            isIdle: row.IsIdle === true || row.IsIdle === 1
        };
    });

    res.json({
      operators: operatorsRes.recordset,
      supervisors: supervisorsRes.recordset,
      shiftsData,
      shiftsMeta
    });

  } catch (err) {
    console.error("Fetch Details Error:", err);
    res.status(500).send('Server Error');
  }
};

exports.saveDetails = async (req, res) => {
  try {
    const { date, disa, shiftsData, shiftsMeta } = req.body;

    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      const deleteReq = new sql.Request(transaction);
      await deleteReq.query`
        DELETE FROM DmmSettingParameters 
        WHERE RecordDate = ${date} AND DisaMachine = ${disa}
      `;

      for (const shift of [1, 2, 3]) {
          const rows = shiftsData[shift] || [];
          const meta = shiftsMeta[shift] || { operator: '', supervisor: '', isIdle: false };
          const isIdleVal = meta.isIdle ? 1 : 0;

          // Always save at least one row per shift to retain the isIdle and operator status
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
      
    } catch (err) {
      await transaction.rollback();
      console.error("Transaction Error:", err);
      res.status(500).send('Database Transaction Error');
    }
  } catch (err) {
    console.error("Controller Error:", err);
    res.status(500).send('Server Error');
  }
};