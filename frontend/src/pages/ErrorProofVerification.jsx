import { useEffect, useState } from "react";
import axios from "axios";
import Header from "../components/Header";

// Auto-calculate Shift and Date based on exact timings
const getShiftAndDate = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const time = hours + (minutes / 60); 
  
  let shift = "";

  if (time >= 7 && time < 15.5) {
    shift = "I"; // 7:00 AM to 3:30 PM
  } else if (time >= 15.5 && time < 24) {
    shift = "II"; // 3:30 PM to 12:00 AM
  } else {
    shift = "III"; // 12:00 AM to 7:00 AM
    now.setDate(now.getDate() - 1);
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { recordDate: `${day}-${month}-${year}`, dbDate: `${year}-${month}-${day}`, shift };
};

// DEFAULT ERROR PROOF FROM YOUR CODE
const defaultErrorProofs = [
  {
    line: "All the 3 DISA Lines",
    name: "Mould gap sensor Presure 0.2 bar applied on the mould partling line alarm and line stoppage interlink control prevention",
    nature: "If mould Gap forms, pressure drops below 0.2 bar which gives alarm with red light and line will stopage",
    frequency: "Once in 10 days or every VAT cleaning"
  },
];

const ErrorProofVerification = () => {
  const initialTimeData = getShiftAndDate();

  // Observations State (Stores which rows are OK or NOT_OK)
  const [observations, setObservations] = useState({}); 

  // Reaction Plan State (Opens if ANY row is NOT_OK)
  const [sNo, setSNo] = useState(1);
  const [recordDate] = useState(initialTimeData.dbDate);
  const [displayDate] = useState(initialTimeData.recordDate);
  const [shift] = useState(initialTimeData.shift);
  
  const [errorProofNo, setErrorProofNo] = useState("");
  const [problem, setProblem] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [status] = useState("Pending"); 
  const [reviewedByReaction, setReviewedByReaction] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [remarks, setRemarks] = useState("");

  const [verifiedBy, setVerifiedBy] = useState("");
  const [reviewedByMain, setReviewedByMain] = useState("");

  const [inchargeList, setInchargeList] = useState([]);
  const [showDropdown2, setShowDropdown2] = useState(false);

  const fetchInitialData = async () => {
    try {
      const snoRes = await axios.get("http://localhost:5000/api/error-proof/next-sno");
      setSNo(snoRes.data.nextSNo);

      const inchargeRes = await axios.get("http://localhost:5000/api/error-proof/incharges");
      setInchargeList(inchargeRes.data);
    } catch (err) {
      console.error("Error fetching initial data", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Handle radio button clicks
  const handleObservationChange = (index, value) => {
    setObservations(prev => ({ ...prev, [index]: value }));
  };

  // ------------------------------------------------------------------------
  // THIS IS THE MAGIC LINE: It only turns TRUE if "Checked Not OK" is clicked
  // ------------------------------------------------------------------------
  const hasNotOk = Object.values(observations).includes("NOT_OK");

  const handleSubmit = async () => {
    if (Object.keys(observations).length === 0) {
      alert("Please check OK or Not OK for at least one Error Proof.");
      return;
    }

    if (hasNotOk && (!errorProofNo || !problem)) {
      alert("Reaction Plan requires an Error Proof No and Problem description.");
      return;
    }

    try {
      for (const index of Object.keys(observations)) {
        const proof = defaultErrorProofs[index];
        const obsResult = observations[index];

        await axios.post("http://localhost:5000/api/error-proof/add-verification", {
          line: proof.line, 
          errorProofName: proof.name, 
          natureOfErrorProof: proof.nature, 
          frequency: proof.frequency,
          recordDate, shift, observationResult: obsResult, verifiedBy, reviewedBy: reviewedByMain
        });

        // Only save reaction plan if this specific proof failed
        if (obsResult === "NOT_OK") {
          await axios.post("http://localhost:5000/api/error-proof/add-reaction", {
            sNo, errorProofNo, errorProofName: proof.name, recordDate, shift,
            problem, rootCause, correctiveAction, status,
            reviewedBy: reviewedByReaction, approvedBy, remarks
          });
        }
      }

      alert("Records saved successfully!");
      
      setObservations({});
      setErrorProofNo(""); setProblem(""); setRootCause(""); 
      setCorrectiveAction(""); setReviewedByMain(""); setReviewedByReaction(""); 
      setApprovedBy(""); setRemarks("");
      
      fetchInitialData();
    } catch (err) {
      console.error(err);
      alert("Error saving record");
    }
  };

  const handleGenerateReport = () => {
    window.open("http://localhost:5000/api/error-proof/report", "_blank");
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center p-6">
        
        <div className="bg-white w-full max-w-[100rem] rounded-xl p-8 shadow-2xl overflow-x-auto mt-6">
          <h2 className="text-2xl font-bold mb-4 text-center text-gray-800 uppercase tracking-wide">
            Error Proof Verification Check List
          </h2>

          <div className="flex justify-center gap-12 items-center bg-gray-50 border border-gray-200 py-3 px-8 rounded-lg mb-8 max-w-2xl mx-auto shadow-sm">
            <div className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="text-gray-500 uppercase text-sm tracking-wider">Date:</span> 
              {displayDate}
            </div>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="text-lg font-bold text-blue-700 flex items-center gap-2">
              <span className="text-gray-500 uppercase text-sm tracking-wider">Shift:</span> 
              {shift}
            </div>
          </div>

          <div className="min-w-[1100px] mb-8">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-100 text-gray-700 text-center">
                <tr>
                  <th className="border border-gray-300 p-3 w-32">Line</th>
                  <th className="border border-gray-300 p-3 w-80">Error Proof Name</th>
                  <th className="border border-gray-300 p-3 w-80">Nature of Error Proof</th>
                  <th className="border border-gray-300 p-3 w-32">Frequency</th>
                  <th className="border border-gray-300 p-3 w-40">Observation</th>
                </tr>
              </thead>
              <tbody>
                {defaultErrorProofs.map((proof, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-300 p-4 align-middle text-center">
                      <p className="text-gray-900 font-bold">{proof.line}</p>
                    </td>
                    <td className="border border-gray-300 p-4 align-middle">
                      <p className="text-gray-800 leading-relaxed">{proof.name}</p>
                    </td>
                    <td className="border border-gray-300 p-4 align-middle">
                      <p className="text-gray-700 leading-relaxed">{proof.nature}</p>
                    </td>
                    <td className="border border-gray-300 p-4 align-middle text-center">
                      <p className="text-gray-900 font-semibold">{proof.frequency}</p>
                    </td>
                    <td className="border border-gray-300 p-4 align-middle">
                      <div className="flex flex-col gap-3 ml-4">
                        <label className="flex items-center gap-2 cursor-pointer text-green-700 font-bold text-sm">
                          <input 
                            type="radio" 
                            name={`obs-${index}`} 
                            className="w-4 h-4 accent-green-600"
                            checked={observations[index] === "OK"} 
                            onChange={() => handleObservationChange(index, "OK")} 
                          />
                          Checked OK
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-red-700 font-bold text-sm">
                          <input 
                            type="radio" 
                            name={`obs-${index}`} 
                            className="w-4 h-4 accent-red-600"
                            checked={observations[index] === "NOT_OK"} 
                            onChange={() => handleObservationChange(index, "NOT_OK")} 
                          />
                          Checked Not OK
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ------------------------------------------------------------------------ */}
          {/* REACTION PLAN ONLY DISPLAYS IF `hasNotOk` IS TRUE                        */}
          {/* ------------------------------------------------------------------------ */}
          {hasNotOk && (
            <div className="mt-8 animate-fade-in border-t-2 border-red-200 pt-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800 text-center bg-red-100 py-2 rounded">
                REACTION PLAN REQUIRED
              </h3>

              <div className="min-w-[1300px] pb-32">
                <table className="w-full border-collapse border border-gray-300 text-sm mb-6 relative">
                  <thead className="bg-gray-100 text-gray-700 text-center text-xs uppercase tracking-wide">
                    <tr>
                      <th className="border border-gray-300 p-2 w-16">S.No</th>
                      <th className="border border-gray-300 p-2 w-28">Error Proof No</th>
                      <th className="border border-gray-300 p-2 w-48">Problem</th>
                      <th className="border border-gray-300 p-2 w-48">Root Cause</th>
                      <th className="border border-gray-300 p-2 w-48">Corrective Action</th>
                      <th className="border border-gray-300 p-2 w-24">Status</th>
                      <th className="border border-gray-300 p-2 w-40">Reviewed By</th>
                      <th className="border border-gray-300 p-2 w-40">Approved By</th>
                      <th className="border border-gray-300 p-2 w-48">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-2 align-top text-center">
                        <input type="text" className="w-full border p-2 rounded bg-gray-100 cursor-not-allowed text-center font-bold text-gray-700" value={sNo} readOnly title="Auto-generated" />
                      </td>
                      <td className="border border-gray-300 p-2 align-top">
                        <input type="text" className="w-full border p-2 rounded focus:outline-blue-500" placeholder="No..." value={errorProofNo} onChange={(e) => setErrorProofNo(e.target.value)} />
                      </td>
                      <td className="border border-gray-300 p-2 align-top">
                        <textarea className="w-full border p-2 rounded focus:outline-red-400 min-h-[50px] resize-y border-red-200" placeholder="Describe problem..." value={problem} onChange={(e) => setProblem(e.target.value)} />
                      </td>
                      <td className="border border-gray-300 p-2 align-top">
                        <textarea className="w-full border p-2 rounded focus:outline-blue-500 min-h-[50px] resize-y" placeholder="Root cause..." value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
                      </td>
                      <td className="border border-gray-300 p-2 align-top">
                        <textarea className="w-full border p-2 rounded focus:outline-blue-500 min-h-[50px] resize-y" placeholder="Action taken..." value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
                      </td>
                      <td className="border border-gray-300 p-2 align-top text-center">
                        <input type="text" className="w-full border p-2 rounded bg-yellow-50 text-yellow-700 font-bold text-center cursor-not-allowed" value={status} readOnly />
                      </td>
                      
                      <td className="border border-gray-300 p-2 align-top relative">
                        <input 
                          type="text" 
                          className="w-full border p-2 rounded focus:outline-blue-500 text-left" 
                          placeholder="Search..." 
                          value={reviewedByReaction} 
                          onChange={(e) => {
                            setReviewedByReaction(e.target.value);
                            setShowDropdown2(true);
                          }} 
                          onFocus={() => setShowDropdown2(true)}
                          onBlur={() => setTimeout(() => setShowDropdown2(false), 200)}
                        />
                        {showDropdown2 && (
                          <ul className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-300 rounded shadow-xl max-h-48 overflow-y-auto z-[9999]">
                            {inchargeList
                              .filter(person => (person.name || person.Name || "").toLowerCase().includes((reviewedByReaction || "").toLowerCase()))
                              .map((person, index) => {
                                const dbName = person.name || person.Name || "";
                                return (
                                  <li 
                                    key={index} 
                                    className="p-2 text-left hover:bg-gray-100 cursor-pointer"
                                    onMouseDown={(e) => {
                                      e.preventDefault(); 
                                      setReviewedByReaction(dbName);
                                      setShowDropdown2(false);
                                    }}
                                  >
                                    {dbName}
                                  </li>
                                );
                              })
                            }
                          </ul>
                        )}
                      </td>

                      <td className="border border-gray-300 p-2 align-top">
                        <input type="text" className="w-full border p-2 rounded focus:outline-blue-500" placeholder="Sign / Name" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
                      </td>
                      <td className="border border-gray-300 p-2 align-top">
                        <textarea className="w-full border p-2 rounded focus:outline-blue-500 min-h-[50px] resize-y" placeholder="Remarks..." value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4 mt-8">
            <button onClick={handleGenerateReport} className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-3 rounded font-bold transition-colors shadow-lg">
              Download PDF Report
            </button>
            <button onClick={handleSubmit} className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg">
              Save Verification
            </button>
          </div>
          
        </div>
      </div>
    </>
  );
};

export default ErrorProofVerification;