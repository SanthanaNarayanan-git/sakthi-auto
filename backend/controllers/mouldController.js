const  sql  = require('../db');

const mouldController = {
  // --- 1. Get Details for ALL Shifts at once ---
  getMouldDetails: async (req, res) => {
    try {
      const { date, disa } = req.query;

      const result = await sql.query`
        SELECT * FROM UnPouredMouldDetails 
        WHERE RecordDate = ${date} AND DisaMachine = ${disa}
      `;

      // Map the array into an object keyed by Shift Number (1, 2, 3)
      const shiftData = { 1: {}, 2: {}, 3: {} };
      result.recordset.forEach(row => {
          shiftData[row.Shift] = row;
      });

      res.json(shiftData);

    } catch (err) {
      console.error('Error fetching mould details:', err);
      res.status(500).send('Server Error');
    }
  },

  // --- 2. Save/Update ALL 3 Shifts in one transaction ---
  saveMouldDetails: async (req, res) => {
    try {
      const { date, disa, shiftsData } = req.body;

      const transaction = new sql.Transaction();
      await transaction.begin();

      try {
        for (const shift of [1, 2, 3]) {
          const data = shiftsData[shift];
          const request = new sql.Request(transaction);

          const checkRes = await request.query`
              SELECT COUNT(*) as count FROM UnPouredMouldDetails 
              WHERE RecordDate = ${date} AND DisaMachine = ${disa} AND Shift = ${shift}
          `;

          // Fallback to 0 if data is empty
          const getVal = (val) => parseInt(val) || 0;

          const writeRequest = new sql.Request(transaction);

          if (checkRes.recordset[0].count > 0) {
            await writeRequest.query`
              UPDATE UnPouredMouldDetails SET 
                PatternChange = ${getVal(data.patternChange)}, HeatCodeChange = ${getVal(data.heatCodeChange)}, 
                MouldBroken = ${getVal(data.mouldBroken)}, AmcCleaning = ${getVal(data.amcCleaning)}, 
                MouldCrush = ${getVal(data.mouldCrush)}, CoreFalling = ${getVal(data.coreFalling)},
                SandDelay = ${getVal(data.sandDelay)}, DrySand = ${getVal(data.drySand)},
                NozzleChange = ${getVal(data.nozzleChange)}, NozzleLeakage = ${getVal(data.nozzleLeakage)}, 
                SpoutPocking = ${getVal(data.spoutPocking)}, StRod = ${getVal(data.stRod)},
                QcVent = ${getVal(data.qcVent)}, OutMould = ${getVal(data.outMould)}, 
                LowMg = ${getVal(data.lowMg)}, GradeChange = ${getVal(data.gradeChange)}, MsiProblem = ${getVal(data.msiProblem)},
                BrakeDown = ${getVal(data.brakeDown)}, Wom = ${getVal(data.wom)}, DevTrail = ${getVal(data.devTrail)},
                PowerCut = ${getVal(data.powerCut)}, PlannedOff = ${getVal(data.plannedOff)}, 
                VatCleaning = ${getVal(data.vatCleaning)}, Others = ${getVal(data.others)},
                RowTotal = ${getVal(data.rowTotal)}, LastUpdated = GETDATE()
              WHERE RecordDate = ${date} AND DisaMachine = ${disa} AND Shift = ${shift}
            `;
          } else {
            await writeRequest.query`
              INSERT INTO UnPouredMouldDetails (
                RecordDate, DisaMachine, Shift, 
                PatternChange, HeatCodeChange, MouldBroken, AmcCleaning, MouldCrush, CoreFalling,
                SandDelay, DrySand, NozzleChange, NozzleLeakage, SpoutPocking, StRod,
                QcVent, OutMould, LowMg, GradeChange, MsiProblem, BrakeDown, Wom, DevTrail,
                PowerCut, PlannedOff, VatCleaning, Others, RowTotal
              ) VALUES (
                ${date}, ${disa}, ${shift}, 
                ${getVal(data.patternChange)}, ${getVal(data.heatCodeChange)}, ${getVal(data.mouldBroken)}, ${getVal(data.amcCleaning)}, ${getVal(data.mouldCrush)}, ${getVal(data.coreFalling)},
                ${getVal(data.sandDelay)}, ${getVal(data.drySand)}, ${getVal(data.nozzleChange)}, ${getVal(data.nozzleLeakage)}, ${getVal(data.spoutPocking)}, ${getVal(data.stRod)},
                ${getVal(data.qcVent)}, ${getVal(data.outMould)}, ${getVal(data.lowMg)}, ${getVal(data.gradeChange)}, ${getVal(data.msiProblem)},
                ${getVal(data.brakeDown)}, ${getVal(data.wom)}, ${getVal(data.devTrail)},
                ${getVal(data.powerCut)}, ${getVal(data.plannedOff)}, ${getVal(data.vatCleaning)}, ${getVal(data.others)}, ${getVal(data.rowTotal)}
              )
            `;
          }
        }
        await transaction.commit();
        res.json({ success: true, message: 'All shifts saved successfully' });
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } catch (err) {
      console.error('Error saving details:', err);
      res.status(500).send('Server Error');
    }
  }
};

module.exports = mouldController;