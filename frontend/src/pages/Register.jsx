import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Castle, UserRound, Mail, LockKeyhole, ArrowRight } from 'lucide-react'
import { registerUser, loginUser } from '../services/api'

const Register = () => {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Create the account first.
      await registerUser(formData)

      // Automatically log in after registration.
      const response = await loginUser({
        email: formData.email.trim(),
        password: formData.password,
      })

      const { token, user } = response.data

      if (!token) {
        throw new Error('Login succeeded but no authentication token was returned.')
      }

      // Save authentication so protected API requests work.
      localStorage.setItem('token', token)

      if (user) {
        localStorage.setItem('user', JSON.stringify(user))
      }

      // Send the newly registered user to the dashboard.
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Registration failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070914] px-4 py-10 text-white">
      <div className="ambient ambient-one pointer-events-none absolute" />
      <div className="ambient ambient-two pointer-events-none absolute" />

      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <div className="neon-icon">
            <Castle size={25} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide">
              CLASH<span className="text-cyan-400">TRACK</span>
            </h1>
            <p className="text-[10px] tracking-[0.3em] text-slate-500">
              VILLAGE INTELLIGENCE
            </p>
          </div>
        </Link>

        <div className="neon-panel p-6 sm:p-8">
          <div className="mb-7 text-center">
            <p className="text-xs font-bold tracking-[0.25em] text-cyan-400">
              CREATE YOUR ACCOUNT
            </p>
            <h2 className="mt-3 text-3xl font-black">
              Join the <span className="neon-text">battle.</span>
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Start planning your village upgrades.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Username
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#070914]/80 px-4 transition focus-within:border-cyan-400/60 focus-within:shadow-[0_0_18px_rgba(34,211,238,0.08)]">
                <UserRound size={18} className="text-cyan-400" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                  className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Email
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#070914]/80 px-4 transition focus-within:border-cyan-400/60 focus-within:shadow-[0_0_18px_rgba(34,211,238,0.08)]">
                <Mail size={18} className="text-cyan-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                  className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Password
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#070914]/80 px-4 transition focus-within:border-cyan-400/60 focus-within:shadow-[0_0_18px_rgba(34,211,238,0.08)]">
                <LockKeyhole size={18} className="text-cyan-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password (min. 8 characters)"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-rose-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 py-3.5 font-extrabold text-[#070914] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Create account'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-xs text-slate-600">OR</span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <p className="text-center text-sm text-slate-400">
            Already have an account?
          </p>

          <Link
            to="/login"
            className="mt-3 flex w-full items-center justify-center rounded-xl border border-cyan-400/30 py-3 text-sm font-bold text-cyan-300 transition hover:border-cyan-300 hover:bg-cyan-400/[0.06]"
          >
            Login
          </Link>
        </div>

        <p className="mt-6 text-center text-xs tracking-widest text-slate-600">
          COC BASE TRACKER · UPGRADE SMARTER
        </p>
      </div>
    </div>
  )
}

export default Register