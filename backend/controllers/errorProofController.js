const  sql  = require('../db');

exports.getDetails = async (req, res) => {
  try {
    const { machine } = req.query;

    const mainRes = await sql.query`
      SELECT * FROM ErrorProofVerifications 
      WHERE DisaMachine = ${machine}
    `;

    const reactionRes = await sql.query`
      SELECT rp.* FROM ReactionPlans rp
      INNER JOIN ErrorProofVerifications epv ON rp.VerificationId = epv.Id
      WHERE epv.DisaMachine = ${machine}
      ORDER BY rp.SNo ASC
    `;

    res.json({
      verifications: mainRes.recordset,
      reactionPlans: reactionRes.recordset
    });

  } catch (err) {
    console.error("Fetch Error:", err);
    res.status(500).send('Server Error');
  }
};

exports.saveDetails = async (req, res) => {
  try {
    const { machine, verifications, reactionPlans, headerDetails } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      // 1. Update existing records or Insert brand new ones
      for (const row of verifications) {
        
        // Safely check if this is a temporary ID created by the frontend for a new machine
        const isNewRecord = String(row.Id).startsWith('temp');
        const queryReq = new sql.Request(transaction);

        if (isNewRecord) {
          // INSERT NEW ROW AND GET THE NEWLY GENERATED SQL ID
          const result = await queryReq.query`
            INSERT INTO ErrorProofVerifications (
              RecordDate, DisaMachine, Line, ErrorProofName, NatureOfErrorProof, Frequency,
              Date1_Shift1_Res, Date1_Shift2_Res, Date1_Shift3_Res,
              ReviewedByHOF, ApprovedBy
            ) 
            OUTPUT INSERTED.Id
            VALUES (
              ${today}, ${machine}, ${row.Line}, ${row.ErrorProofName}, ${row.NatureOfErrorProof}, ${row.Frequency},
              ${row.Date1_Shift1_Res || null}, ${row.Date1_Shift2_Res || null}, ${row.Date1_Shift3_Res || null},
              ${headerDetails.reviewedBy}, ${headerDetails.approvedBy}
            )
          `;

          const newDbId = result.recordset[0].Id;

          // CRITICAL FIX: Replace 'temp-x' with the real SQL Integer ID in the Reaction Plans array
          if (reactionPlans && reactionPlans.length > 0) {
            reactionPlans.forEach(rp => {
              if (String(rp.VerificationId) === String(row.Id)) {
                rp.VerificationId = newDbId;
              }
            });
          }

        } else {
          // NORMAL UPDATE FOR EXISTING DB ROWS
          await queryReq.query`
            UPDATE ErrorProofVerifications
            SET 
              RecordDate = ${today},
              Date1_Shift1_Res = ${row.Date1_Shift1_Res || null},
              Date1_Shift2_Res = ${row.Date1_Shift2_Res || null},
              Date1_Shift3_Res = ${row.Date1_Shift3_Res || null},
              ReviewedByHOF = ${headerDetails.reviewedBy},
              ApprovedBy = ${headerDetails.approvedBy},
              LastUpdated = GETDATE()
            WHERE Id = ${row.Id}
          `;
        }
      }

      // 2. Clear out existing reaction plans safely (Only for existing SQL integer IDs)
      const validIdsForDeletion = verifications
        .filter(v => !String(v.Id).startsWith('temp'))
        .map(v => v.Id);

      for (const validId of validIdsForDeletion) {
        const deleteReq = new sql.Request(transaction);
        await deleteReq.query`DELETE FROM ReactionPlans WHERE VerificationId = ${validId}`;
      }

      // 3. Insert fresh reaction plans
      if (reactionPlans && reactionPlans.length > 0) {
        for (const plan of reactionPlans) {
          const insertReq = new sql.Request(transaction);
          await insertReq.query`
            INSERT INTO ReactionPlans (
              VerificationId, SNo, ErrorProofNo, ErrorProofName, VerificationDateShift,
              Problem, RootCause, CorrectiveAction, Status, ReviewedBy, ApprovedBy, Remarks
            ) VALUES (
              ${plan.VerificationId}, ${plan.SNo}, ${plan.ErrorProofNo || ''}, ${plan.ErrorProofName}, ${plan.VerificationDateShift},
              ${plan.Problem}, ${plan.RootCause}, ${plan.CorrectiveAction}, ${plan.Status}, 
              ${plan.ReviewedBy}, ${plan.ApprovedBy}, ${plan.Remarks}
            )
          `;
        }
      }

      await transaction.commit();
      res.json({ success: true, message: 'Saved successfully' });

    } catch (err) {
      await transaction.rollback();
      throw err; 
    }
  } catch (err) {
    console.error("Save Error:", err);
    res.status(500).json({ error: err.message, message: 'Server Error' });
  }
};