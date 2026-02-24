import React from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";

const AdminDashboard = () => {
  const navigate = useNavigate();

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center p-10">
        <div className="bg-white w-full max-w-4xl rounded-xl p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
            <button
              onClick={() => navigate("/add-user")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold transition-colors shadow-md"
            >
              + Add New User
            </button>
          </div>
          
          <div className="text-gray-600 text-center py-20">
            <p>Welcome to the Admin Panel. Select an action from above.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;