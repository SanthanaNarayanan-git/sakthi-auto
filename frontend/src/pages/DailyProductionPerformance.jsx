import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- HELPER: Calculate Production Date (Strict 7 AM to 7 AM Logic) ---
const getProductionDate = () => {
  const now = new Date();
  const hours = now.getHours();

  const prodDate = new Date(now);
  if (hours < 7) {
    prodDate.setDate(prodDate.getDate() - 1);
  }
  
  const year = prodDate.getFullYear();
  const month = String(prodDate.getMonth() + 1).padStart(2, '0');
  const day = String(prodDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`; 
};

// ==========================================
// INTERNAL COMPONENT: SearchableSelect
// ==========================================
const SearchableSelect = ({ label, options, displayKey, onSelect, required, value, placeholder }) => {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  const filtered = options.filter((item) =>
    item[displayKey]?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full">
      {label && <label className="font-bold text-gray-700 block mb-1 text-left">{label} {required && "*"}</label>}
      <input
        type="text"
        required={required}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full border border-gray-400 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm bg-white"
        placeholder={placeholder || `Search...`}
      />
      {open && (
        <ul className="absolute z-50 bg-white border border-gray-300 w-full max-h-40 overflow-y-auto rounded shadow-xl mt-1 text-left">
          {filtered.length > 0 ? (
            filtered.map((item, index) => (
              <li
                key={index}
                onClick={() => {
                  setSearch(item[displayKey]);
                  setOpen(false);
                  onSelect(item); 
                }}
                className="p-2 hover:bg-orange-100 cursor-pointer text-sm border-b border-gray-100 last:border-0"
              >
                {item[displayKey]}
              </li>
            ))
          ) : (
            <li className="p-2 text-gray-500 text-sm">No results found</li>
          )}
        </ul>
      )}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================
const DailyProductionPerformance = () => {
  const [productionDate, setProductionDate] = useState(getProductionDate());
  const [disa, setDisa] = useState(""); 
  const [resetKey, setResetKey] = useState(0);

  // --- DROPDOWN DATA ---
  const [components, setComponents] = useState([]);
  const [incharges, setIncharges] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:5000/api/components")
      .then((res) => setComponents(res.data))
      .catch((err) => console.error("Failed to fetch components", err));

    axios.get("http://localhost:5000/api/incharges")
      .then((res) => setIncharges(res.data))
      .catch((err) => console.error("Failed to fetch incharges", err));
  }, []);

  // --- STATE: SUMMARY TABLE ---
  const [summary, setSummary] = useState({
    I: { pouredMoulds: "", tonnage: "", casted: "", value: "" },
    II: { pouredMoulds: "", tonnage: "", casted: "", value: "" },
    III: { pouredMoulds: "", tonnage: "", casted: "", value: "" },
  });

  // --- STATE: DELAYS TABLE (Fetched automatically) ---
  const [delays, setDelays] = useState([]);

  // Auto-fetch Summary & Delays data when Date OR DISA changes
  useEffect(() => {
    const fetchData = async () => {
      if (!productionDate || !disa) {
        setDelays([]); 
        return; 
      }
      
      try {
        // Fetch Summary Stats
        const sumRes = await axios.get(`http://localhost:5000/api/daily-performance/summary?date=${productionDate}&disa=${disa}`);
        const fetchedData = sumRes.data;
        
        setSummary((prev) => {
          const newSummary = { ...prev };
          ["I", "II", "III"].forEach(s => {
            newSummary[s].pouredMoulds = "";
            newSummary[s].tonnage = "";
          });

          fetchedData.forEach(item => {
            if (newSummary[item.shift]) {
              newSummary[item.shift].pouredMoulds = item.totalPouredMoulds || "";
              if (item.totalTonnageKg) {
                newSummary[item.shift].tonnage = (item.totalTonnageKg / 1000).toFixed(3);
              }
            }
          });
          return newSummary;
        });

        // Fetch Delays
        const delayRes = await axios.get(`http://localhost:5000/api/daily-performance/delays?date=${productionDate}&disa=${disa}`);
        setDelays(delayRes.data);

      } catch (err) {
        console.error("Failed to fetch daily data", err);
      }
    };

    fetchData();
  }, [productionDate, disa]); 

  // --- STATE: DETAILS TABLE ---
  const [details, setDetails] = useState([
    {
      patternCode: "",
      itemDescription: "",
      planned: "",     
      unplanned: "",   
      mouldsProd: "",
      mouldsPour: "",
      cavity: "",
      unitWeight: "",
      totalWeight: "",
    },
  ]);

  const [unplannedReasons, setUnplannedReasons] = useState("");

  const [signatures, setSignatures] = useState({
    incharge: "",
    hof: "",
    hod: ""
  });

  const handleSummaryChange = (shift, field, value) => {
    setSummary((prev) => ({
      ...prev,
      [shift]: { ...prev[shift], [field]: value },
    }));
  };

  const summaryTotals = {
    pouredMoulds: ["I", "II", "III"].reduce((acc, s) => acc + (Number(summary[s].pouredMoulds) || 0), 0),
    tonnage: ["I", "II", "III"].reduce((acc, s) => acc + (Number(summary[s].tonnage) || 0), 0),
    casted: ["I", "II", "III"].reduce((acc, s) => acc + (Number(summary[s].casted) || 0), 0),
    value: ["I", "II", "III"].reduce((acc, s) => acc + (Number(summary[s].value) || 0), 0),
  };

  const addDetailRow = () => {
    setDetails([
      ...details,
      { patternCode: "", itemDescription: "", planned: "", unplanned: "", mouldsProd: "", mouldsPour: "", cavity: "", unitWeight: "", totalWeight: "" },
    ]);
  };

  const removeDetailRow = (index) => {
    if (details.length === 1) return;
    const updated = details.filter((_, i) => i !== index);
    setDetails(updated);
  };

  const handleComponentSelect = (index, item) => {
    const updated = [...details];
    
    updated[index].patternCode = item.code;
    updated[index].itemDescription = item.description;
    
    updated[index].cavity = item.cavity !== null && item.cavity !== undefined ? item.cavity : "";
    updated[index].unitWeight = item.pouredWeight !== null && item.pouredWeight !== undefined ? item.pouredWeight : "";

    const pour = Number(updated[index].mouldsPour) || 0;
    const weight = Number(item.pouredWeight) || 0;
    updated[index].totalWeight = pour > 0 && weight > 0 ? Math.round(pour * weight) : "";

    setDetails(updated);
  };

  const handleDetailChange = (index, field, value) => {
    const updated = [...details];
    updated[index][field] = value;

    if (field === "mouldsPour") {
      const pour = Number(updated[index].mouldsPour) || 0;
      const weight = Number(updated[index].unitWeight) || 0;
      updated[index].totalWeight = pour > 0 && weight > 0 ? Math.round(pour * weight) : "";
    }

    setDetails(updated);
  };

  const detailTotals = details.reduce(
    (acc, curr) => {
      acc.mouldsProd += Number(curr.mouldsProd) || 0;
      acc.mouldsPour += Number(curr.mouldsPour) || 0;
      acc.totalWeight += Number(curr.totalWeight) || 0;
      return acc;
    },
    { mouldsProd: 0, mouldsPour: 0, totalWeight: 0 }
  );

 const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
        productionDate,
        disa,
        summary,
        details,
        unplannedReasons,
        signatures,
        delays // ⬅️ This now sends the auto-filled delay data to be saved permanently
    };

    try {
        await axios.post("http://localhost:5000/api/daily-performance", payload);
        toast.success("Report saved successfully!");
        
        // Reset Logic...
        setSummary({
            I: { pouredMoulds: "", tonnage: "", casted: "", value: "" },
            II: { pouredMoulds: "", tonnage: "", casted: "", value: "" },
            III: { pouredMoulds: "", tonnage: "", casted: "", value: "" },
        });
        setDetails([{ patternCode: "", itemDescription: "", planned: "", unplanned: "", mouldsProd: "", mouldsPour: "", cavity: "", unitWeight: "", totalWeight: "" }]);
        setUnplannedReasons("");
        setSignatures({ incharge: "", hof: "", hod: "" });
        setDisa(""); 
        setResetKey(prev => prev + 1); 

    } catch (err) {
        console.error(err);
        toast.error("Submission failed.");
    }
};

  const handleDownload = async () => {
    if (!disa || !productionDate) {
      toast.warning("Please select DISA and ensure the date is present to download the report.");
      return;
    }

    try {
      const response = await axios.get("http://localhost:5000/api/daily-performance/download-pdf", { 
        params: { date: productionDate, disa: disa },
        responseType: "blob" 
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Daily_Performance_${productionDate}_${disa}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      toast.success("PDF Downloaded successfully!");
    } catch (err) {
      console.error("Download failed", err);
      if (err.response && err.response.status === 404) {
        toast.error("No saved report found for this Date & DISA. Please submit the form first.");
      } else {
        toast.error("Failed to download PDF.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">
        
        {/* HEADER */}
        <div className="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 tracking-wide uppercase">
            DAILY PRODUCTION PERFORMANCE (FOUNDRY - B)
          </h1>
          
          <div className="flex items-center gap-6">
            <div className="w-40">
              <label className="font-bold text-gray-700 block mb-1 text-sm">DISA- *</label>
              <select 
                name="disa" 
                required 
                value={disa} 
                onChange={(e) => setDisa(e.target.value)} 
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold"
              >
                <option value="">Select</option>
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
              </select>
            </div>

            <div className="w-48">
              <label className="font-bold text-gray-700 block mb-1 text-sm">DATE OF PRODUCTION :</label>
              <input 
                type="date" 
                value={productionDate} 
                readOnly
                className="w-full border border-gray-300 p-2 rounded bg-gray-100 cursor-not-allowed outline-none text-sm font-semibold text-gray-500" 
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8 min-w-[1100px]">

          {/* 1. SUMMARY TABLE */}
          <div>
            <table className="w-full border-collapse border border-gray-800 text-sm text-center">
              <thead className="text-gray-800 font-bold bg-gray-100">
                <tr>
                  <th className="border border-gray-800 p-2 w-32">SHIFT</th>
                  <th className="border border-gray-800 p-2">POURED MOULDS</th>
                  <th className="border border-gray-800 p-2">TONNAGE</th>
                  <th className="border border-gray-800 p-2">CASTED *</th>
                  <th className="border border-gray-800 p-2">VALUE *</th>
                </tr>
              </thead>
              <tbody>
                {["I", "II", "III"].map((shift) => (
                  <tr key={shift} className="bg-white">
                    <td className="border border-gray-800 p-2 font-bold bg-gray-50">{shift}</td>
                    <td className="border border-gray-800 p-0">
                      <input 
                        type="number" 
                        value={summary[shift].pouredMoulds} 
                        readOnly
                        placeholder="Auto"
                        className="w-full h-full text-center outline-none bg-gray-50 py-2 cursor-not-allowed font-semibold text-gray-600" 
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input 
                        type="number" 
                        step="0.001" 
                        value={summary[shift].tonnage} 
                        readOnly
                        placeholder="Auto"
                        className="w-full h-full text-center outline-none bg-gray-50 py-2 cursor-not-allowed font-semibold text-gray-600" 
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input 
                        type="number" 
                        step="0.01" 
                        required
                        value={summary[shift].casted} 
                        onChange={(e) => handleSummaryChange(shift, "casted", e.target.value)} 
                        className="w-full h-full text-center outline-none bg-transparent py-2" 
                      />
                    </td>
                    <td className="border border-gray-800 p-0">
                      <input 
                        type="number" 
                        step="0.01" 
                        required
                        value={summary[shift].value} 
                        onChange={(e) => handleSummaryChange(shift, "value", e.target.value)} 
                        className="w-full h-full text-center outline-none bg-transparent py-2" 
                      />
                    </td>
                  </tr>
                ))}
                {/* TOTAL ROW */}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-800">
                  <td className="border border-gray-800 p-2">TOTAL</td>
                  <td className="border border-gray-800 p-2">{summaryTotals.pouredMoulds || ""}</td>
                  <td className="border border-gray-800 p-2">{summaryTotals.tonnage > 0 ? summaryTotals.tonnage.toFixed(3) : ""}</td>
                  <td className="border border-gray-800 p-2">{summaryTotals.casted > 0 ? summaryTotals.casted.toFixed(2) : ""}</td>
                  <td className="border border-gray-800 p-2">{summaryTotals.value > 0 ? summaryTotals.value.toFixed(2) : ""}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2. DETAILS TABLE */}
          <div>
            <div className="flex items-center justify-end mb-2">
              <button type="button" onClick={addDetailRow} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-1 rounded shadow text-sm">
                + Add Row
              </button>
            </div>
            
            <table className="w-full border-collapse border border-gray-800 text-sm text-center relative z-0">
              <thead className="bg-gray-100 text-gray-800 font-bold border-b-2 border-gray-800">
                <tr>
                  <th className="border border-gray-800 p-2 w-10" rowSpan="2">Sl.<br/>No.</th>
                  <th className="border border-gray-800 p-2 w-48" rowSpan="2">Pattern Code *</th>
                  <th className="border border-gray-800 p-2 w-64" rowSpan="2">Item Description</th>
                  <th className="border border-gray-800 p-1" colSpan="2">Item</th>
                  <th className="border border-gray-800 p-2 w-24" rowSpan="2">Number of<br/>Moulds Prod. *</th>
                  <th className="border border-gray-800 p-2 w-24" rowSpan="2">Number of<br/>Moulds Pour. *</th>
                  <th className="border border-gray-800 p-2 w-16" rowSpan="2">No. of<br/>Cavity</th>
                  <th className="border border-gray-800 p-2 w-56" rowSpan="2">Poured WT (Kg)</th>
                  <th className="border border-gray-800 p-2 w-10" rowSpan="2">Act</th>
                </tr>
                <tr>
                  <th className="border border-gray-800 p-1 font-normal w-16 text-xs">Planned *</th>
                  <th className="border border-gray-800 p-1 font-normal w-20 text-xs">Un Planned *</th>
                </tr>
              </thead>
              <tbody>
                {details.map((row, index) => (
                  <tr key={index} className="bg-white hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-800 p-1 font-bold">{index + 1}</td>
                    
                    <td className="border border-gray-800 p-1 relative overflow-visible">
                      <SearchableSelect 
                        key={`pattern-${index}-${resetKey}`}
                        options={components} 
                        displayKey="code" 
                        required
                        value={row.patternCode} 
                        placeholder="Select Code"
                        onSelect={(item) => handleComponentSelect(index, item)} 
                      />
                    </td>
                    
                    <td className="border border-gray-800 p-0">
                      <input type="text" value={row.itemDescription} readOnly className="w-full h-full text-left outline-none bg-gray-50 text-gray-700 py-2 px-2 cursor-not-allowed" />
                    </td>
                    
                    <td className="border border-gray-800 p-0">
                      <input type="number" required value={row.planned} onChange={(e) => handleDetailChange(index, "planned", e.target.value)} className="w-full h-full text-center outline-none bg-transparent py-2" />
                    </td>
                    
                    <td className="border border-gray-800 p-0">
                      <input type="number" required value={row.unplanned} onChange={(e) => handleDetailChange(index, "unplanned", e.target.value)} className="w-full h-full text-center outline-none bg-transparent py-2" />
                    </td>
                    
                    <td className="border border-gray-800 p-0">
                      <input type="number" required value={row.mouldsProd} onChange={(e) => handleDetailChange(index, "mouldsProd", e.target.value)} className="w-full h-full text-center outline-none bg-transparent py-2" />
                    </td>
                    
                    <td className="border border-gray-800 p-0">
                      <input type="number" required value={row.mouldsPour} onChange={(e) => handleDetailChange(index, "mouldsPour", e.target.value)} className="w-full h-full text-center outline-none bg-transparent py-2 font-bold" />
                    </td>
                    
                    <td className="border border-gray-800 p-0">
                      <input type="number" value={row.cavity} readOnly className="w-full h-full text-center outline-none bg-gray-50 text-gray-700 py-2 cursor-not-allowed font-bold" />
                    </td>
                    
                    <td className="border border-gray-800 p-0">
                      <div className="flex items-center justify-center w-full h-full gap-1 px-1 font-semibold text-gray-700">
                        <span>[</span>
                        <input 
                          type="number" 
                          step="0.001" 
                          placeholder="Wt" 
                          value={row.unitWeight} 
                          readOnly
                          className="w-12 text-center outline-none border-b border-gray-400 bg-transparent py-1 font-normal text-gray-500 cursor-not-allowed" 
                        />
                        <span className="mx-1">X</span>
                        <input 
                          type="number" 
                          value={row.mouldsPour} 
                          readOnly 
                          placeholder="Qty"
                          className="w-12 text-center outline-none border-b border-gray-400 bg-transparent py-1 font-normal text-gray-500 cursor-not-allowed" 
                        />
                        <span>] =</span>
                        <span className="w-16 text-right pr-1 text-black font-bold">{row.totalWeight}</span>
                      </div>
                    </td>
                    
                    <td className="border border-gray-800 p-0 text-center">
                      {details.length > 1 && (
                        <button type="button" onClick={() => removeDetailRow(index)} className="text-red-500 font-bold hover:text-red-700 w-full h-full" title="Remove Row">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
                
                {/* DETAILS TOTAL ROW */}
                <tr className="bg-gray-100 font-bold text-gray-800 border-t-2 border-gray-800">
                  <td className="border border-gray-800 p-2"></td>
                  <td className="border border-gray-800 p-2"></td>
                  <td className="border border-gray-800 p-2"></td>
                  <td className="border border-gray-800 p-2"></td>
                  <td className="border border-gray-800 p-2 text-center text-black tracking-widest text-sm">TOTAL</td>
                  <td className="border border-gray-800 p-2 text-center text-black">{detailTotals.mouldsProd > 0 ? detailTotals.mouldsProd : ""}</td>
                  <td className="border border-gray-800 p-2 text-center text-black">{detailTotals.mouldsPour > 0 ? detailTotals.mouldsPour : ""}</td>
                  <td className="border border-gray-800 p-2 bg-gray-100"></td>
                  <td className="border border-gray-800 p-0">
                    <div className="flex items-center justify-center w-full h-full gap-1 px-1 font-bold text-gray-800">
                      <span>[</span>
                      <span className="w-12 text-center inline-block"></span>
                      <span className="mx-1">X</span>
                      <span className="w-12 text-center inline-block"></span>
                      <span>] =</span>
                      <span className="w-16 text-right pr-1 text-black">{detailTotals.totalWeight > 0 ? Math.round(detailTotals.totalWeight) : ""}</span>
                    </div>
                  </td>
                  <td className="border border-gray-800 p-2"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. PRODUCTION DELAYS TABLE (Auto-Fetched) */}
          <div>
            <table className="w-full border-collapse border border-gray-800 text-sm text-center">
              <thead className="bg-gray-100 text-gray-800 font-bold">
                <tr>
                  <th className="border border-gray-800 p-2 bg-gray-200" colSpan="4">Production delays / Remarks</th>
                </tr>
                <tr>
                  <th className="border border-gray-800 p-2 w-16">S.No.</th>
                  <th className="border border-gray-800 p-2 w-32">Shift</th>
                  <th className="border border-gray-800 p-2 w-48">Duration</th>
                  <th className="border border-gray-800 p-2">Reasons</th>
                </tr>
              </thead>
              <tbody>
                {/* ⬇️ ONLY RENDER ROWS IF THERE IS ACTUAL DELAY DATA ⬇️ */}
                {delays.length > 0 ? (
                  delays.map((delay, index) => (
                    <tr key={index} className="bg-white">
                      <td className="border border-gray-800 p-2">{index + 1}</td>
                      <td className="border border-gray-800 p-2">{delay.shift}</td>
                      <td className="border border-gray-800 p-2">{delay.duration}</td>
                      <td className="border border-gray-800 p-2 text-left px-4">{delay.reason}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="bg-white h-10">
                    <td className="border border-gray-800 p-2 text-gray-500 font-semibold italic" colSpan="4">
                      {disa ? "No delays recorded for this date and DISA." : "Select DISA to view delays."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 4. FOOTER & REASONS */}
          <div className="border-2 border-gray-800 flex flex-col min-h-[100px]">
            <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-400">
              Reasons for producing un-planned items.
            </div>
            <textarea
              className="w-full h-full p-2 outline-none resize-none text-sm bg-transparent"
              placeholder="Type reasons here (Optional)..."
              value={unplannedReasons}
              onChange={(e) => setUnplannedReasons(e.target.value)}
            />
          </div>

          {/* 5. SIGNATURES (Using SearchableSelect) */}
          <div className="flex justify-between items-end mt-12 mb-4 px-10">
            <div className="w-64">
              <SearchableSelect 
                key={`sign-inc-${resetKey}`}
                label="In-charge" 
                options={incharges} 
                displayKey="name" 
                required
                value={signatures.incharge} 
                onSelect={(item) => setSignatures({...signatures, incharge: item.name})} 
              />
            </div>
            <div className="w-64">
              <SearchableSelect 
                key={`sign-hof-${resetKey}`}
                label="HOF" 
                options={incharges} 
                displayKey="name" 
                required
                value={signatures.hof} 
                onSelect={(item) => setSignatures({...signatures, hof: item.name})} 
              />
            </div>
            <div className="w-64">
              <SearchableSelect 
                key={`sign-hod-${resetKey}`}
                label="HOD - Production" 
                options={incharges} 
                displayKey="name" 
                required
                value={signatures.hod} 
                onSelect={(item) => setSignatures({...signatures, hod: item.name})} 
              />
            </div>
          </div>
          
          {/* BUTTONS */}
          <div className="flex justify-end gap-4 mt-2 pt-4 border-t border-gray-300">
            <button type="button" onClick={handleDownload} className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded font-bold transition-colors flex items-center gap-2 shadow-lg">
              <span>⬇️</span> Generate Report (PDF)
            </button>
            <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg">
              Submit Form
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default DailyProductionPerformance;