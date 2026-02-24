import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- HELPER: Calculate Production Date & Shift ---
const getProductionDateTime = () => {
  const now = new Date();
  const hours = now.getHours();
  const mins = now.getMinutes();
  const time = hours + mins / 60; 

  let shift = "I";
  if (time >= 7 && time < 15.5) {
    shift = "I"; 
  } else if (time >= 15.5 && time < 24) {
    shift = "II"; 
  } else {
    shift = "III"; 
  }

  const prodDate = new Date(now);
  if (hours < 7) {
    prodDate.setDate(prodDate.getDate() - 1);
  }
  
  const year = prodDate.getFullYear();
  const month = String(prodDate.getMonth() + 1).padStart(2, '0');
  const day = String(prodDate.getDate()).padStart(2, '0');
  
  return { date: `${year}-${month}-${day}`, shift };
};

// ==========================================
// INTERNAL COMPONENT: SearchableSelect
// ==========================================
const SearchableSelect = ({ label, options, displayKey, onSelect, required, value }) => {
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
      {label && <label className="font-medium text-gray-700 block mb-1">{label}</label>}
      <input
        type="text"
        required={required}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
        placeholder={`Search ${label || ''}`}
      />
      {open && (
        <ul className="absolute z-10 bg-white border border-gray-300 w-full max-h-40 overflow-y-auto rounded shadow-lg mt-1">
          {filtered.length > 0 ? (
            filtered.map((item, index) => (
              <li
                key={index}
                onClick={() => {
                  setSearch(item[displayKey]);
                  setOpen(false);
                  onSelect(item);
                }}
                className="p-2 hover:bg-orange-50 cursor-pointer text-sm"
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
const DisamaticProductReport = () => {
  const { date: initDate, shift: initShift } = getProductionDateTime();

  const initialFormState = {
    disa: "",
    date: initDate,
    shift: initShift,
    incharge: "",
    member: "",
    ppOperator: "", 
    significantEvent: "",
    maintenance: "",
    supervisorName: "",
  };

  const [formData, setFormData] = useState(() => {
    const savedDraft = localStorage.getItem("disaFormDraft");
    if (savedDraft) {
      const parsed = JSON.parse(savedDraft);
      return { ...parsed, date: initDate, shift: initShift };
    }
    return initialFormState;
  });

  const [productions, setProductions] = useState([
    { componentName: "", pouredWeight: "", mouldCounterNo: "", produced: 0, poured: "", cycleTime: "", mouldsPerHour: "", remarks: "" }
  ]);
  const [resetKey, setResetKey] = useState(0);

  const [incharges, setIncharges] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [operators, setOperators] = useState([]);
  const [components, setComponents] = useState([]);
  const [previousMouldCounter, setPreviousMouldCounter] = useState(0);
  const [nextShiftPlans, setNextShiftPlans] = useState([{ componentName: "", plannedMoulds: "", remarks: "" }]);
  const [delays, setDelays] = useState([{ delayType: "", startTime: "", endTime: "", duration: 0 }]);
  const [delaysMaster, setDelaysMaster] = useState([]);
  const [mouldHardness, setMouldHardness] = useState([{ componentName: "", penetrationPP: "", penetrationSP: "", bScalePP: "", bScaleSP: "", remarks: "" }]);
  const [patternTemps, setPatternTemps] = useState([{ componentName: "", pp: "", sp: "", remarks: "" }]);
  const [supervisors, setSupervisors] = useState([]);

  useEffect(() => {
    localStorage.setItem("disaFormDraft", JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    const checkOnLoad = async () => {
      if (formData.disa && formData.date && formData.shift) {
        try {
          const res = await axios.get(`http://localhost:5000/api/forms/last-personnel`, {
            params: { disa: formData.disa, date: formData.date, shift: formData.shift }
          });
          if (res.data) {
            setFormData((prev) => ({
              ...prev,
              incharge: res.data.incharge || prev.incharge,
              member: res.data.member || prev.member,
              ppOperator: res.data.ppOperator || prev.ppOperator,
              supervisorName: res.data.supervisorName || prev.supervisorName,
            }));
          }

          const counterRes = await axios.get(`http://localhost:5000/api/forms/last-mould-counter`, {
            params: { disa: formData.disa }
          });
          setPreviousMouldCounter(Number(counterRes.data.lastMouldCounter) || 0);
        } catch (err) {
          console.error(err);
        }
      }
    };
    checkOnLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    axios.get("http://localhost:5000/api/delays").then((res) => setDelaysMaster(res.data));
    axios.get("http://localhost:5000/api/incharges").then((res) => setIncharges(res.data));
    axios.get("http://localhost:5000/api/employees").then((res) => setEmployees(res.data));
    axios.get("http://localhost:5000/api/operators").then((res) => setOperators(res.data));
    axios.get("http://localhost:5000/api/components").then((res) => setComponents(res.data));
    axios.get("http://localhost:5000/api/supervisors").then((res) => setSupervisors(res.data));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDisaChange = async (e) => {
    const selectedDisa = e.target.value;
    
    setFormData((prev) => ({ 
      ...prev, 
      disa: selectedDisa,
      incharge: "", member: "", ppOperator: "", supervisorName: ""
    }));

    if (selectedDisa) {
      try {
        const res = await axios.get(`http://localhost:5000/api/forms/last-personnel`, {
          params: { disa: selectedDisa, date: formData.date, shift: formData.shift }
        });
        
        if (res.data) {
          setFormData((prev) => ({
            ...prev,
            incharge: res.data.incharge || "",
            member: res.data.member || "",
            ppOperator: res.data.ppOperator || "",
            supervisorName: res.data.supervisorName || "",
          }));
          toast.success(`Personnel auto-filled for DISA-${selectedDisa}`);
        } else {
          toast.info(`First entry for DISA-${selectedDisa} in this shift.`);
        }

        const counterRes = await axios.get(`http://localhost:5000/api/forms/last-mould-counter`, {
          params: { disa: selectedDisa }
        });
        const fetchedCounter = Number(counterRes.data.lastMouldCounter) || 0;
        setPreviousMouldCounter(fetchedCounter);
        
        recalculateChain(productions, fetchedCounter);

      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    }
  };

  const addNextShiftPlan = () => setNextShiftPlans([...nextShiftPlans, { componentName: "", plannedMoulds: "", remarks: "" }]);
  const updateNextShiftPlan = (index, field, value) => {
    const updated = [...nextShiftPlans];
    updated[index][field] = value;
    setNextShiftPlans(updated);
  };
  const removeNextShiftPlan = (index) => {
    if (nextShiftPlans.length === 1) return;
    setNextShiftPlans(nextShiftPlans.filter((_, i) => i !== index));
  };

  const addDelay = () => setDelays([...delays, { delayType: "", startTime: "", endTime: "", duration: 0 }]);
  const removeDelay = (index) => {
    if (delays.length === 1) return;
    setDelays(delays.filter((_, i) => i !== index));
  };
  const updateDelay = (index, field, value) => {
    const updated = [...delays];
    updated[index][field] = value;
    if (updated[index].startTime && updated[index].endTime) {
      const start = new Date(`1970-01-01T${updated[index].startTime}`);
      const end = new Date(`1970-01-01T${updated[index].endTime}`);
      let diff = (end - start) / 60000; 
      if (diff < 0) diff += 1440;
      updated[index].duration = Math.round(diff);
    } else {
      updated[index].duration = 0;
    }
    setDelays(updated);
  };

  const addMouldHardness = () => setMouldHardness([...mouldHardness, { componentName: "", penetrationPP: "", penetrationSP: "", bScalePP: "", bScaleSP: "", remarks: "" }]);
  const removeMouldHardness = (index) => {
    if (mouldHardness.length === 1) return;
    setMouldHardness(mouldHardness.filter((_, i) => i !== index));
  };
  const updateMouldHardness = (index, field, value) => {
    const updated = [...mouldHardness];
    updated[index][field] = value;
    setMouldHardness(updated);
  };

  const addPatternTemp = () => setPatternTemps([...patternTemps, { componentName: "", pp: "", sp: "", remarks: "" }]);
  const updatePatternTemp = (index, field, value) => {
    const updated = [...patternTemps];
    updated[index][field] = value;
    setPatternTemps(updated);
  };
  const removePatternTemp = (index) => {
    if (patternTemps.length === 1) return;
    setPatternTemps(patternTemps.filter((_, i) => i !== index));
  };

  const addProduction = () => {
    setProductions([...productions, { componentName: "", pouredWeight: "", mouldCounterNo: "", produced: 0, poured: "", cycleTime: "", mouldsPerHour: "", remarks: "" }]);
  };
  
  const removeProduction = (index) => {
    if (productions.length === 1) return;
    const updated = productions.filter((_, i) => i !== index);
    recalculateChain(updated);
  };

  const updateProduction = (index, field, value, extraValue = null) => {
    const updated = [...productions];
    
    if (field === "componentName") {
      updated[index].componentName = value;
      updated[index].pouredWeight = extraValue;
      setProductions(updated);
    }
    else if (field === "mouldCounterNo") {
      updated[index][field] = value;
      recalculateChain(updated); 
    } 
    else if (field === "cycleTime") {
      updated[index][field] = value;
      const c = Number(value);
      if (c > 0) {
        updated[index].mouldsPerHour = Math.round(3600 / c);
      } else {
        updated[index].mouldsPerHour = "";
      }
      setProductions(updated);
    } 
    else {
      updated[index][field] = value;
      setProductions(updated);
    }
  };

  const recalculateChain = (list, baseCounter = previousMouldCounter) => {
    let prev = baseCounter; 
    const newList = list.map((item) => {
      const current = Number(item.mouldCounterNo) || 0;
      const produced = current ? Math.max(0, current - prev) : 0;
      if (current) prev = current; 
      return { ...item, produced };
    });
    setProductions(newList);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.post("http://localhost:5000/api/forms", {
        ...formData, productions, delays, nextShiftPlans, mouldHardness, patternTemps,
      });

      const lastItem = productions[productions.length - 1];
      const newPreviousCounter = lastItem.mouldCounterNo 
        ? Number(lastItem.mouldCounterNo) 
        : previousMouldCounter;
      setPreviousMouldCounter(newPreviousCounter);

      const { date: newDate, shift: newShift } = getProductionDateTime();
      setFormData((prev) => ({
        ...initialFormState,
        disa: prev.disa, 
        date: newDate,
        shift: newShift,
        incharge: prev.incharge,
        member: prev.member,
        ppOperator: prev.ppOperator,
        supervisorName: prev.supervisorName
      }));

      setProductions([{ componentName: "", pouredWeight: "", mouldCounterNo: "", produced: 0, poured: "", cycleTime: "", mouldsPerHour: "", remarks: "" }]);
      setNextShiftPlans([{ componentName: "", plannedMoulds: "", remarks: "" }]);
      setDelays([{ delayType: "", startTime: "", endTime: "", duration: 0 }]);
      setMouldHardness([{ componentName: "", penetrationPP: "", penetrationSP: "", bScalePP: "", bScaleSP: "", remarks: "" }]);
      setPatternTemps([{ componentName: "", pp: "", sp: "", remarks: "" }]);
      setResetKey((prev) => prev + 1);

      toast.success("Report submitted! Ready for next entry.");
    } catch (err) {
      console.error(err);
      toast.error("Submission failed");
    }
  };

  const handleDownload = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/forms/download-pdf", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Disamatic_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error("Download failed", err);
      toast.error("Failed to download PDF.");
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
      
      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          DISAMATIC PRODUCTION REPORT
        </h2>

        <form onSubmit={handleSubmit} className="min-w-[1100px] flex flex-col gap-6">
          
          <div className="grid grid-cols-3 gap-6 bg-gray-100 p-4 rounded-lg border border-gray-300">
            <div>
              <label className="font-bold text-gray-700 block mb-1">DISA- *</label>
              <select name="disa" required value={formData.disa} onChange={handleDisaChange} className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500">
                <option value="">Select</option>
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Date</label>
              <input type="date" name="date" required value={formData.date} readOnly className="w-full border border-gray-300 p-2 rounded bg-gray-200 cursor-not-allowed text-gray-600 outline-none" />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Shift</label>
              <select name="shift" required value={formData.shift} disabled className="w-full border border-gray-300 p-2 rounded bg-gray-200 cursor-not-allowed text-gray-600 appearance-none">
                <option value="I">I (7 AM - 3:30 PM)</option>
                <option value="II">II (3:30 PM - 12 AM)</option>
                <option value="III">III (12 AM - 7 AM)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <SearchableSelect key={`incharge-${resetKey}`} label="Incharge *" options={incharges} displayKey="name" required value={formData.incharge} onSelect={(item) => setFormData({ ...formData, incharge: item.name })} />
            <SearchableSelect key={`ppOperator-${resetKey}`} label="P/P Operator *" options={operators} displayKey="operatorName" required value={formData.ppOperator} onSelect={(item) => setFormData({ ...formData, ppOperator: item.operatorName })} />
            <SearchableSelect key={`member-${resetKey}`} label="Member *" options={employees} displayKey="name" required value={formData.member} onSelect={(item) => setFormData({ ...formData, member: item.name })} />
          </div>

          {/* PRODUCTION SECTION */}
          <div className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Production :</h2>
              <button type="button" onClick={addProduction} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-1 rounded flex items-center justify-center leading-none" title="Add Row">+ Add Row</button>
            </div>

            {productions.map((prod, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50 relative">
                {productions.length > 1 && (
                  <button type="button" onClick={() => removeProduction(index)} className="absolute top-2 right-2 text-red-600 font-bold hover:text-red-800">✕</button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div>
                    <label className="font-medium text-sm text-gray-700">Mould Counter No. *</label>
                    <input type="number" required value={prod.mouldCounterNo} onChange={(e) => updateProduction(index, "mouldCounterNo", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" />
                  </div>
                  <div>
                    <label className="font-medium text-sm text-gray-700 block mb-1">Component Name *</label>
                    <SearchableSelect 
                      key={`prod-comp-${index}-${resetKey}`} 
                      options={components} 
                      displayKey="description" 
                      required 
                      value={prod.componentName} 
                      onSelect={(item) => updateProduction(index, "componentName", item.description, item.pouredWeight)} 
                    />
                    {prod.pouredWeight != null && prod.pouredWeight !== "" && (
                      <p className="text-sm font-semibold text-blue-600 mt-2 ml-1">
                        Poured Weight: {prod.pouredWeight}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="font-medium text-sm text-gray-500">Produced (Updates Previous Form)</label>
                    <input type="number" value={prod.produced} readOnly className="w-full border border-gray-300 p-2 rounded bg-gray-200 cursor-not-allowed text-gray-600" />
                  </div>
                  <div>
                    <label className="font-medium text-sm text-gray-700">Poured *</label>
                    <input type="number" required value={prod.poured} onChange={(e) => updateProduction(index, "poured", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" />
                  </div>
                  <div>
                    <label className="font-medium text-sm text-gray-700">Cycle Time *</label>
                    <input type="number" step="0.01" required value={prod.cycleTime} onChange={(e) => updateProduction(index, "cycleTime", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" />
                  </div>
                  <div>
                    <label className="font-medium text-sm text-gray-500">Moulds Per Hour (Auto-Calculated)</label>
                    <input type="number" value={prod.mouldsPerHour} readOnly className="w-full border border-gray-300 p-2 rounded bg-gray-200 cursor-not-allowed text-gray-600" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="font-medium text-sm text-gray-700">Remarks</label>
                    <textarea value={prod.remarks} onChange={(e) => updateProduction(index, "remarks", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-10 resize-y" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* NEXT SHIFT PLAN */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-800">Next Shift Plan :</h2>
              <button type="button" onClick={addNextShiftPlan} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none">+</button>
            </div>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 p-2 text-left w-1/3">Component Name *</th>
                  <th className="border border-gray-300 p-2 w-48">Planned Moulds *</th>
                  <th className="border border-gray-300 p-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {nextShiftPlans.map((plan, index) => (
                  <tr key={index} className="bg-white">
                    <td className="border border-gray-300 p-2 align-top">
                      <SearchableSelect key={`nextPlan-${index}-${resetKey}`} options={components} displayKey="description" required value={plan.componentName} onSelect={(item) => updateNextShiftPlan(index, "componentName", item.description)} />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input type="number" min={1} required value={plan.plannedMoulds} onChange={(e) => updateNextShiftPlan(index, "plannedMoulds", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <div className="flex gap-2">
                        <textarea value={plan.remarks} onChange={(e) => updateNextShiftPlan(index, "remarks", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-10 resize-y" />
                        {nextShiftPlans.length > 1 && <button type="button" onClick={() => removeNextShiftPlan(index)} className="text-red-500 font-bold hover:text-red-700 px-2">✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* DELAYS */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-800">Delays :</h2>
              <button type="button" onClick={addDelay} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none">+</button>
            </div>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 p-2 text-left w-1/3">Reason *</th>
                  <th className="border border-gray-300 p-2 w-48">Start Time *</th>
                  <th className="border border-gray-300 p-2 w-48">End Time *</th>
                  <th className="border border-gray-300 p-2">Duration (Mins)</th>
                </tr>
              </thead>
              <tbody>
                {delays.map((delay, index) => (
                  <tr key={index} className="bg-white">
                    <td className="border border-gray-300 p-2 align-top">
                      <SearchableSelect key={`delay-${index}-${resetKey}`} options={delaysMaster} displayKey="reasonName" required value={delay.delayType} onSelect={(item) => updateDelay(index, "delayType", item.reasonName)} />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input type="time" required value={delay.startTime} onChange={(e) => updateDelay(index, "startTime", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input type="time" required value={delay.endTime} onChange={(e) => updateDelay(index, "endTime", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <div className="flex gap-2">
                        <input type="number" value={delay.duration} readOnly className="w-full border border-gray-300 p-2 rounded bg-gray-100 cursor-not-allowed text-gray-600" />
                        {delays.length > 1 && <button type="button" onClick={() => removeDelay(index)} className="text-red-500 font-bold hover:text-red-700 px-2">✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOULD HARDNESS */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-800">Mould Hardness :</h2>
              <button type="button" onClick={addMouldHardness} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none">+</button>
            </div>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th rowSpan="2" className="border border-gray-300 p-2 text-left w-64 align-middle">Component Name *</th>
                  <th colSpan="2" className="border border-gray-300 p-1 text-center bg-gray-200">Penetration (N/cm²)</th>
                  <th colSpan="2" className="border border-gray-300 p-1 text-center bg-gray-200">B-Scale</th>
                  <th rowSpan="2" className="border border-gray-300 p-2 align-middle">Remarks</th>
                </tr>
                <tr>
                  <th className="border border-gray-300 p-2 w-24">PP *</th>
                  <th className="border border-gray-300 p-2 w-24">SP *</th>
                  <th className="border border-gray-300 p-2 w-24">PP *</th>
                  <th className="border border-gray-300 p-2 w-24">SP *</th>
                </tr>
              </thead>
              <tbody>
                {mouldHardness.map((item, index) => (
                  <tr key={index} className="bg-white">
                    <td className="border border-gray-300 p-2 align-top">
                      <SearchableSelect key={`hardness-${index}-${resetKey}`} options={components} displayKey="description" required value={item.componentName} onSelect={(comp) => updateMouldHardness(index, "componentName", comp.description)} />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="number" step="0.01" required 
                        value={item.penetrationPP} 
                        onChange={(e) => updateMouldHardness(index, "penetrationPP", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${item.penetrationPP && Number(item.penetrationPP) < 20 ? 'border-red-500' : ''}`} 
                      />
                      {item.penetrationPP && Number(item.penetrationPP) < 20 && <p className="text-red-500 text-xs mt-1 font-medium">Min: 20</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="number" step="0.01" required 
                        value={item.penetrationSP} 
                        onChange={(e) => updateMouldHardness(index, "penetrationSP", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${item.penetrationSP && Number(item.penetrationSP) < 20 ? 'border-red-500' : ''}`} 
                      />
                      {item.penetrationSP && Number(item.penetrationSP) < 20 && <p className="text-red-500 text-xs mt-1 font-medium">Min: 20</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="number" required 
                        value={item.bScalePP} 
                        onChange={(e) => updateMouldHardness(index, "bScalePP", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${item.bScalePP && Number(item.bScalePP) < 85 ? 'border-red-500' : ''}`} 
                      />
                      {item.bScalePP && Number(item.bScalePP) < 85 && <p className="text-red-500 text-xs mt-1 font-medium">Min: 85</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="number" required 
                        value={item.bScaleSP} 
                        onChange={(e) => updateMouldHardness(index, "bScaleSP", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${item.bScaleSP && Number(item.bScaleSP) < 85 ? 'border-red-500' : ''}`} 
                      />
                      {item.bScaleSP && Number(item.bScaleSP) < 85 && <p className="text-red-500 text-xs mt-1 font-medium">Min: 85</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <div className="flex gap-2">
                        <textarea value={item.remarks} onChange={(e) => updateMouldHardness(index, "remarks", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-10 resize-y" />
                        {mouldHardness.length > 1 && <button type="button" onClick={() => removeMouldHardness(index)} className="text-red-500 font-bold hover:text-red-700 px-2">✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PATTERN TEMPERATURE */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-800">Pattern Temp. (°C) :</h2>
              <button type="button" onClick={addPatternTemp} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none">+</button>
            </div>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 p-2 text-left w-1/3">Component Name *</th>
                  <th className="border border-gray-300 p-2 w-32">PP *</th>
                  <th className="border border-gray-300 p-2 w-32">SP *</th>
                  <th className="border border-gray-300 p-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {patternTemps.map((pt, index) => (
                  <tr key={index} className="bg-white">
                    <td className="border border-gray-300 p-2 align-top">
                      <SearchableSelect key={`patternTemp-${index}-${resetKey}`} options={components} displayKey="description" required value={pt.componentName} onSelect={(item) => updatePatternTemp(index, "componentName", item.description)} />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="number" min={45} required 
                        value={pt.pp} 
                        onChange={(e) => updatePatternTemp(index, "pp", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${pt.pp && Number(pt.pp) < 45 ? 'border-red-500' : ''}`} 
                      />
                      {pt.pp && Number(pt.pp) < 45 && <p className="text-red-500 text-xs mt-1 font-medium">Min: 45</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="number" min={45} required 
                        value={pt.sp} 
                        onChange={(e) => updatePatternTemp(index, "sp", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${pt.sp && Number(pt.sp) < 45 ? 'border-red-500' : ''}`} 
                      />
                      {pt.sp && Number(pt.sp) < 45 && <p className="text-red-500 text-xs mt-1 font-medium">Min: 45</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <div className="flex gap-2">
                        <textarea value={pt.remarks} onChange={(e) => updatePatternTemp(index, "remarks", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-10 resize-y" />
                        {patternTemps.length > 1 && <button type="button" onClick={() => removePatternTemp(index)} className="text-red-500 font-bold hover:text-red-700 px-2">✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* OTHER DETAILS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Significant Event</label>
              <textarea name="significantEvent" value={formData.significantEvent} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-20 resize-y" placeholder="Enter any significant event..." />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Maintenance</label>
              <textarea name="maintenance" value={formData.maintenance} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-20 resize-y" placeholder="Enter maintenance details..." />
            </div>
          </div>
          
          <div className="w-1/3">
            <SearchableSelect key={`supervisor-${resetKey}`} label="Supervisor Name *" options={supervisors} displayKey="supervisorName" required value={formData.supervisorName} onSelect={(item) => setFormData({ ...formData, supervisorName: item.supervisorName })} />
          </div>

          {/* BUTTONS */}
          <div className="flex justify-end gap-4 mt-6">
            <button type="button" onClick={handleDownload} className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded font-bold transition-colors flex items-center gap-2">
              <span>⬇️</span> Generate Report (PDF)
            </button>
            <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 rounded font-bold transition-colors shadow-md">
              Submit Form
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
};

export default DisamaticProductReport;