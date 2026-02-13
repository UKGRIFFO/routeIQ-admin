'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Wrong password');
      }
    } catch {
      setError('Connection error');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#06090D',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(52,211,153,.06) 0%, transparent 60%)',
    }}>
      <div style={{
        width: 380, padding: '44px 36px', background: '#111821',
        border: '1px solid #1A2332', borderRadius: 20,
        boxShadow: '0 24px 80px rgba(0,0,0,.5)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: 'linear-gradient(135deg, #34D399, #38BDF8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 16, color: '#06090D',
          }}>TP</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#E2E8F0' }}>TePrestamos</div>
            <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Admin Dashboard</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700, color: '#475569',
            textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6,
          }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter admin password"
            autoFocus
            style={{
              width: '100%', padding: '12px 14px', background: '#0C1017',
              border: '1px solid #1A2332', borderRadius: 10, color: '#E2E8F0',
              fontSize: 14, fontFamily: 'inherit', outline: 'none',
              marginBottom: 16,
            }}
          />

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: 'rgba(248,113,113,.12)', color: '#F87171',
              fontSize: 13, fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 10, border: 'none',
              background: '#34D399', color: '#06090D', fontSize: 14, fontWeight: 800,
              fontFamily: 'inherit', cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !password ? 0.5 : 1,
              transition: 'all .15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#334155' }}>
          Secured admin access
        </div>
      </div>
    </div>
  );
}
