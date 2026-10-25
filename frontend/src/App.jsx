import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Register from './pages/Register'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Category from './pages/Category'
import Building from './pages/Building'
import Equipment from './pages/Equipment'
import Heros from './pages/Heros'
import Laboratory from './pages/Laboratory'
import Pets from './pages/Pets'
import Walls from './pages/Walls'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Open Register by default */}
        <Route path="/" element={<Navigate to="/register" replace />} />

        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/category" element={<Category />} />

        <Route path="/building" element={<Building />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/heroes" element={<Heros />} />
        <Route path="/laboratory" element={<Laboratory />} />
        <Route path="/pets" element={<Pets />} />
        <Route path="/walls" element={<Walls />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App