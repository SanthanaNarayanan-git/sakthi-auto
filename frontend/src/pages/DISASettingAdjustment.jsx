import { useEffect, useState, useRef } from "react";
import axios from "axios";
import Header from "../components/Header";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SignatureCanvas from 'react-signature-canvas'; // 🔥 IMPORT ADDED

const MAX_MOULDS = 600000;

const getDefaultDate = () => {
  const now = new Date();
  if (now.getHours() < 7) {
    now.setDate(now.getDate() - 1);
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const DISASettingAdjustment = () => {
  const [recordDate, setRecordDate] = useState(getDefaultDate());
  const [mouldCountNo, setMouldCountNo] = useState("");
  const [prevMouldCountNo, setPrevMouldCountNo] = useState(0);
  const [noOfMoulds, setNoOfMoulds] = useState(0);
  
  const [workCarriedOut, setWorkCarriedOut] = useState([""]);
  const [preventiveWorkCarried, setPreventiveWorkCarried] = useState([""]);
  const [remarks, setRemarks] = useState("");

  // 🔥 Signature Pad Reference
  const sigCanvas = useRef({});

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/disa/last-mould-count")
      .then((res) => {
        setPrevMouldCountNo(res.data.prevMouldCountNo);
      })
      .catch((err) => console.error("Error fetching last count:", err));
  }, []);

  useEffect(() => {
    if (mouldCountNo === "") {
      setNoOfMoulds(0);
      return;
    }

    const current = Number(mouldCountNo);
    let calculatedMoulds = 0;

    if (current >= prevMouldCountNo) {
      calculatedMoulds = current - prevMouldCountNo;
    } else {
      calculatedMoulds = (MAX_MOULDS - prevMouldCountNo) + current;
    }

    setNoOfMoulds(calculatedMoulds);
  }, [mouldCountNo, prevMouldCountNo]);

  const handleWorkCarriedOutChange = (index, value) => {
    const newFields = [...workCarriedOut];
    newFields[index] = value;
    setWorkCarriedOut(newFields);
  };

  const handlePreventiveWorkChange = (index, value) => {
    const newFields = [...preventiveWorkCarried];
    newFields[index] = value;
    setPreventiveWorkCarried(newFields);
  };

  // 🔥 Clear Signature Function
  const clearSignature = () => {
    sigCanvas.current.clear();
  };

  const handleSubmit = async () => {
    
    if (!mouldCountNo) {
      toast.warning("Please enter a Current Mould Counter value.");
      return;
    }

    // 🔥 Check if signature is empty
    if (sigCanvas.current.isEmpty()) {
      toast.warning("Please provide an operator signature.");
      return;
    }

    const finalWorkCarriedOut = workCarriedOut
      .filter((item) => item.trim() !== "")
      .map((item) => `• ${item.trim()}`)
      .join("\n");
      
    const finalPreventiveWork = preventiveWorkCarried
      .filter((item) => item.trim() !== "")
      .map((item) => `• ${item.trim()}`)
      .join("\n");

    // 🔥 Get Base64 String from Canvas
    const signatureData = sigCanvas.current.getCanvas().toDataURL('image/png');

    try {
      await axios.post("http://localhost:5000/api/disa/add", {
        recordDate,
        mouldCountNo: Number(mouldCountNo),
        prevMouldCountNo,
        noOfMoulds,
        workCarriedOut: finalWorkCarriedOut,
        preventiveWorkCarried: finalPreventiveWork,
        operatorSignature: signatureData, // 🔥 SEND SIGNATURE TO BACKEND
        remarks,
      });

      toast.success("Record saved successfully!");

      setPrevMouldCountNo(Number(mouldCountNo));

      setMouldCountNo("");
      setWorkCarriedOut([""]);
      setPreventiveWorkCarried([""]);
      setRemarks("");
      clearSignature(); // 🔥 Clear canvas after successful save
    } catch (err) {
      console.error(err);
      toast.error("Error saving record. Please try again.");
    }
  };

  const handleGenerateReport = () => {
    window.open("http://localhost:5000/api/disa/report", "_blank");
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />

      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
        <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
            DISA Setting Adjustment Record
          </h2>

          <div className="min-w-[1200px]">
            <table className="w-full border-collapse border border-gray-300 text-sm mb-6">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 p-2 w-32">Date</th>
                  <th className="border border-gray-300 p-2 w-36">Current Mould Counter</th>
                  <th className="border border-gray-300 p-2 w-36">Previous Mould Counter</th>
                  <th className="border border-gray-300 p-2 w-36">Calculated No. of Moulds</th>
                  
                  <th className="border border-gray-300 p-2 w-48">
                    <div className="flex items-center justify-between">
                      <span>Work Carried Out</span>
                      <button onClick={() => setWorkCarriedOut([...workCarriedOut, ""])} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none" title="Add another row">+</button>
                    </div>
                  </th>

                  <th className="border border-gray-300 p-2 w-48">
                    <div className="flex items-center justify-between">
                      <span>Preventive Work Carried</span>
                      <button onClick={() => setPreventiveWorkCarried([...preventiveWorkCarried, ""])} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none" title="Add another row">+</button>
                    </div>
                  </th>
                  
                  {/* 🔥 NEW SIGNATURE HEADER */}
                  <th className="border border-gray-300 p-2 w-48">Operator Signature</th>
                  
                  <th className="border border-gray-300 p-2 w-40">Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-2 align-top">
                    <input type="date" className="w-full border p-2 rounded focus:outline-blue-500 text-sm bg-white cursor-pointer" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <input type="number" className="w-full border p-2 rounded focus:outline-blue-500 text-sm" placeholder="Enter count" value={mouldCountNo} onChange={(e) => setMouldCountNo(e.target.value)} />
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <input type="number" className="w-full border p-2 rounded bg-gray-100 cursor-not-allowed text-gray-600 focus:outline-none text-sm" value={prevMouldCountNo} readOnly />
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <input type="number" className="w-full border p-2 rounded bg-gray-100 cursor-not-allowed text-gray-600 focus:outline-none text-sm" value={noOfMoulds} readOnly />
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <div className="flex flex-col gap-2">
                      {workCarriedOut.map((work, index) => (
                        <input key={`work-${index}`} type="text" className="w-full border p-2 rounded focus:outline-blue-500 text-sm" placeholder={`Task ${index + 1}`} value={work} onChange={(e) => handleWorkCarriedOutChange(index, e.target.value)} />
                      ))}
                    </div>
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <div className="flex flex-col gap-2">
                      {preventiveWorkCarried.map((preventive, index) => (
                        <input key={`prev-${index}`} type="text" className="w-full border p-2 rounded focus:outline-blue-500 text-sm" placeholder={`Action ${index + 1}`} value={preventive} onChange={(e) => handlePreventiveWorkChange(index, e.target.value)} />
                      ))}
                    </div>
                  </td>

                  {/* 🔥 NEW SIGNATURE PAD CELL */}
                  <td className="border border-gray-300 p-2 align-top">
                    <div className="flex flex-col items-center">
                      <div className="border border-gray-300 bg-gray-50 rounded w-full mb-2">
                        <SignatureCanvas 
                          ref={sigCanvas} 
                          penColor="blue"
                          canvasProps={{ className: 'w-full h-24 rounded' }} // Responsive width, fixed height
                        />
                      </div>
                      <button onClick={clearSignature} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-1 px-3 rounded transition-colors w-full">
                        Clear Signature
                      </button>
                    </div>
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <textarea className="w-full border p-2 rounded focus:outline-blue-500 text-sm resize-y min-h-[40px] h-full" placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-4 mt-4">
            <button onClick={handleGenerateReport} className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded font-bold transition-colors">
              Generate Report (PDF)
            </button>
            <button onClick={handleSubmit} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 rounded font-bold transition-colors">
              Submit
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DISASettingAdjustment;