import { useEffect, useState } from "react";
import axios from "axios";
import Header from "../components/Header";
// 1. Import Toastify and its CSS
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const MAX_MOULDS = 600000;

// Helper function: Shifts before 7:00 AM count as the previous day
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
  
  // Arrays for dynamic input fields using the + button
  const [workCarriedOut, setWorkCarriedOut] = useState([""]);
  const [preventiveWorkCarried, setPreventiveWorkCarried] = useState([""]);
  const [remarks, setRemarks] = useState("");

  // Fetch previous mould count on component mount
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/disa/last-mould-count")
      .then((res) => {
        setPrevMouldCountNo(res.data.prevMouldCountNo);
      })
      .catch((err) => console.error("Error fetching last count:", err));
  }, []);

  // Calculate moulds correctly (handles rollover if current < previous)
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

  // Handle dynamic field changes
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

  // SUBMIT
  const handleSubmit = async () => {
    if (!mouldCountNo) {
      // 2. Replaced alert with toast.warning
      toast.warning("Please enter a Current Mould Counter value.");
      return;
    }

    // Convert arrays into bullet-pointed strings separated by new lines
    const finalWorkCarriedOut = workCarriedOut
      .filter((item) => item.trim() !== "")
      .map((item) => `• ${item.trim()}`)
      .join("\n");
      
    const finalPreventiveWork = preventiveWorkCarried
      .filter((item) => item.trim() !== "")
      .map((item) => `• ${item.trim()}`)
      .join("\n");

    try {
      await axios.post("http://localhost:5000/api/disa/add", {
        recordDate,
        mouldCountNo: Number(mouldCountNo),
        prevMouldCountNo,
        noOfMoulds,
        workCarriedOut: finalWorkCarriedOut,
        preventiveWorkCarried: finalPreventiveWork,
        remarks,
      });

      // 3. Replaced alert with toast.success
      toast.success("Record saved successfully!");

      // Update previous mould count for the next entry
      setPrevMouldCountNo(Number(mouldCountNo));

      // Reset form fields back to initial states
      setMouldCountNo("");
      setWorkCarriedOut([""]);
      setPreventiveWorkCarried([""]);
      setRemarks("");
    } catch (err) {
      console.error(err);
      // 4. Replaced alert with toast.error
      toast.error("Error saving record. Please try again.");
    }
  };

  // GENERATE PDF
  const handleGenerateReport = () => {
    window.open("http://localhost:5000/api/disa/report", "_blank");
  };

  return (
    <>
      <Header />
      
      {/* 5. Added ToastContainer to render the popups */}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />

      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6">
        <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
            DISA Setting Adjustment Record
          </h2>

          <div className="min-w-[1100px]">
            <table className="w-full border-collapse border border-gray-300 text-sm mb-6">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 p-2 w-32">Date</th>
                  <th className="border border-gray-300 p-2 w-36">Current Mould Counter</th>
                  <th className="border border-gray-300 p-2 w-36">Previous Mould Counter</th>
                  <th className="border border-gray-300 p-2 w-36">Calculated No. of Moulds</th>
                  
                  {/* Work Carried Out Header with + Button */}
                  <th className="border border-gray-300 p-2 w-48">
                    <div className="flex items-center justify-between">
                      <span>Work Carried Out</span>
                      <button
                        onClick={() => setWorkCarriedOut([...workCarriedOut, ""])}
                        className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none"
                        title="Add another row"
                      >
                        +
                      </button>
                    </div>
                  </th>

                  {/* Preventive Work Carried Header with + Button */}
                  <th className="border border-gray-300 p-2 w-48">
                    <div className="flex items-center justify-between">
                      <span>Preventive Work Carried</span>
                      <button
                        onClick={() => setPreventiveWorkCarried([...preventiveWorkCarried, ""])}
                        className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none"
                        title="Add another row"
                      >
                        +
                      </button>
                    </div>
                  </th>
                  
                  <th className="border border-gray-300 p-2 w-48">Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {/* 1. Date (Editable) */}
                  <td className="border border-gray-300 p-2 align-top">
                    <input
                      type="date"
                      className="w-full border p-2 rounded focus:outline-blue-500 text-sm bg-white cursor-pointer"
                      value={recordDate}
                      onChange={(e) => setRecordDate(e.target.value)}
                      title="Select Date"
                    />
                  </td>

                  {/* 2. Current Mould Counter */}
                  <td className="border border-gray-300 p-2 align-top">
                    <input
                      type="number"
                      className="w-full border p-2 rounded focus:outline-blue-500 text-sm"
                      placeholder="Enter count"
                      value={mouldCountNo}
                      onChange={(e) => setMouldCountNo(e.target.value)}
                    />
                  </td>

                  {/* 3. Previous Mould Counter */}
                  <td className="border border-gray-300 p-2 align-top">
                    <input
                      type="number"
                      className="w-full border p-2 rounded bg-gray-100 cursor-not-allowed text-gray-600 focus:outline-none text-sm"
                      placeholder="Previous Count"
                      value={prevMouldCountNo}
                      readOnly
                      title="Auto-fetched from database"
                    />
                  </td>

                  {/* 4. Calculated No. of Moulds */}
                  <td className="border border-gray-300 p-2 align-top">
                    <input
                      type="number"
                      className="w-full border p-2 rounded bg-gray-100 cursor-not-allowed text-gray-600 focus:outline-none text-sm"
                      placeholder="Calculated Moulds"
                      value={noOfMoulds}
                      readOnly
                      title="Auto-calculated"
                    />
                  </td>

                  {/* 5. Work Carried Out (Dynamic Arrays) */}
                  <td className="border border-gray-300 p-2 align-top">
                    <div className="flex flex-col gap-2">
                      {workCarriedOut.map((work, index) => (
                        <input
                          key={`work-${index}`}
                          type="text"
                          className="w-full border p-2 rounded focus:outline-blue-500 text-sm"
                          placeholder={`Task ${index + 1}`}
                          value={work}
                          onChange={(e) => handleWorkCarriedOutChange(index, e.target.value)}
                        />
                      ))}
                    </div>
                  </td>

                  {/* 6. Preventive Work Carried (Dynamic Arrays) */}
                  <td className="border border-gray-300 p-2 align-top">
                    <div className="flex flex-col gap-2">
                      {preventiveWorkCarried.map((preventive, index) => (
                        <input
                          key={`prev-${index}`}
                          type="text"
                          className="w-full border p-2 rounded focus:outline-blue-500 text-sm"
                          placeholder={`Action ${index + 1}`}
                          value={preventive}
                          onChange={(e) => handlePreventiveWorkChange(index, e.target.value)}
                        />
                      ))}
                    </div>
                  </td>

                  {/* 7. Remarks */}
                  <td className="border border-gray-300 p-2 align-top">
                    <textarea
                      className="w-full border p-2 rounded focus:outline-blue-500 text-sm resize-y min-h-[40px] h-full"
                      placeholder="Remarks"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 mt-4">
            <button
              onClick={handleGenerateReport}
              className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded font-bold transition-colors"
            >
              Generate Report (PDF)
            </button>
            <button
              onClick={handleSubmit}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 rounded font-bold transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DISASettingAdjustment;