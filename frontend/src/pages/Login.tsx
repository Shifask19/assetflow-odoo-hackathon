import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Boxes, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/client';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Email and password required');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('All fields are required');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await authApi.signup(form.name, form.email, form.password);
      toast.success('Account created! Please log in.');
      setMode('login');
      setForm(f => ({ ...f, name: '', password: '', confirmPassword: '' }));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) return toast.error('Email required');
    setLoading(true);
    try {
      await authApi.forgotPassword(form.email);
      toast.success('Password reset link sent (demo mode)');
      setMode('login');
    } catch {
      toast.error('Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (email: string, password: string) => {
    setForm(f => ({ ...f, email, password }));
    setMode('login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Boxes className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">AssetFlow</h1>
          <p className="text-slate-400 mt-1">Enterprise Asset & Resource Management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'login' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'signup' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserPlus className="w-4 h-4" /> Create Account
            </button>
          </div>

          <div className="p-6">
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email" value={form.email} onChange={set('email')}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm pr-10"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="button" onClick={() => setMode('forgot')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Forgot password?
                </button>
                <button
                  type="submit" disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Sign In
                </button>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text" value={form.name} onChange={set('name')}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email" value={form.email} onChange={set('email')}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm pr-10"
                      placeholder="Min 6 characters"
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                  <input
                    type="password" value={form.confirmPassword} onChange={set('confirmPassword')}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Repeat password"
                  />
                </div>
                <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Accounts created here are Employee-level. Admins promote roles from Org Setup.
                </p>
                <button
                  type="submit" disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Create Account
                </button>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-sm text-slate-600">Enter your email and we'll send a reset link.</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email" value={form.email} onChange={set('email')}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="you@company.com"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setMode('login')} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
                    Back
                  </button>
                  <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-400">
                    Send Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 bg-slate-800/60 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Demo Accounts (all use Admin@123)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Admin', email: 'admin@assetflow.com' },
              { label: 'Asset Mgr', email: 'manager@assetflow.com' },
              { label: 'Dept Head', email: 'dhead@assetflow.com' },
              { label: 'Employee', email: 'bob@assetflow.com' },
            ].map(({ label, email }) => (
              <button
                key={email}
                onClick={() => quickFill(email, 'Admin@123')}
                className="text-left px-3 py-2 bg-slate-700/60 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
              >
                <div className="font-medium text-white">{label}</div>
                <div className="text-slate-400 truncate">{email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
