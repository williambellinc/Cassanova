'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const PAYMENT_METHODS = [
  { id: 'credit-card', name: 'Credit/Debit Card', icon: '💳', min: 10, max: 10000 },
  { id: 'crypto', name: 'Cryptocurrency', icon: '₿', min: 20, max: 50000 },
  { id: 'bank-transfer', name: 'Bank Transfer', icon: '🏦', min: 50, max: 100000 },
  { id: 'e-wallet', name: 'E-Wallet', icon: '💰', min: 10, max: 5000 },
];

export default function DepositPage() {
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuth();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0].id);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const depositAmount = Number(amount);
    const method = PAYMENT_METHODS.find((m) => m.id === selectedMethod);
    if (!method) return;

    if (!Number.isFinite(depositAmount) || depositAmount < method.min || depositAmount > method.max) {
      setError(`Enter an amount between $${method.min} and $${method.max.toLocaleString()}.`);
      return;
    }

    if (!token) {
      setError('You must be logged in to create a deposit request.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.transactions.deposit(token, {
        amount: depositAmount,
        paymentMethod: method.name,
      });

      if (response.transaction?.status === 'pending') {
        setSuccess(`Deposit request ${response.transaction._id} recorded. It has not been paid or credited. Your available balance remains unchanged until a payment provider confirms settlement.`);
        setAmount('');
      } else {
        setError(response.message || 'Unable to create deposit request.');
      }
    } catch {
      setError('An error occurred while creating the deposit request.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  const selectedPaymentMethod = PAYMENT_METHODS.find((m) => m.id === selectedMethod);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <Link href="/dashboard" className="text-yellow-400 hover:text-yellow-300 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">Deposit Request</h1>
          <p className="text-gray-300">Create a request to fund your account.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 backdrop-blur-lg border border-purple-500/20 rounded-xl p-8">
              <div className="bg-amber-500/10 border border-amber-500/50 text-amber-100 px-4 py-3 rounded-lg mb-6" role="status">
                Payment processing is not connected yet. Submitting this form records a pending request only; it does not charge a payment method or add funds to your balance.
              </div>
              {error && <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6" role="alert">{error}</div>}
              {success && <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-6" role="status">{success}</div>}

              <form onSubmit={handleDeposit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-4">Intended Payment Method</label>
                  <div className="grid grid-cols-2 gap-4">
                    {PAYMENT_METHODS.map((method) => (
                      <button key={method.id} type="button" onClick={() => setSelectedMethod(method.id)}
                        className={`p-4 rounded-lg border-2 transition-all ${selectedMethod === method.id ? 'border-yellow-400 bg-yellow-400/10' : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'}`}>
                        <div className="text-3xl mb-2">{method.icon}</div>
                        <div className="text-white font-medium text-sm">{method.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">Requested Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">$</span>
                    <input id="amount" name="amount" type="number" step="0.01" min={selectedPaymentMethod?.min}
                      max={selectedPaymentMethod?.max} required value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-4 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-xl placeholder-gray-400 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all"
                      placeholder="0.00" />
                  </div>
                  {selectedPaymentMethod && <p className="mt-2 text-sm text-gray-400">Request range: ${selectedPaymentMethod.min} – ${selectedPaymentMethod.max.toLocaleString()}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Quick Select</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[25, 50, 100, 500].map((quickAmount) => (
                      <button key={quickAmount} type="button" onClick={() => setAmount(quickAmount.toString())}
                        className="py-2 px-4 bg-gray-700/50 border border-gray-600 rounded-lg text-white hover:border-yellow-400 hover:bg-yellow-400/10 transition-all">
                        ${quickAmount}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={isLoading}
                  className="w-full py-4 px-6 bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900 font-bold text-lg rounded-lg hover:from-yellow-500 hover:to-yellow-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isLoading ? 'Recording request...' : 'Create pending deposit request'}
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6 text-white">
              <div className="text-sm text-gray-300 mb-1">Available Balance</div>
              <div className="text-3xl font-bold">${user.balance.toFixed(2)}</div>
              <p className="text-xs text-gray-400 mt-2">Pending requests do not change this amount.</p>
            </div>
            <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6">
              <h3 className="text-white font-bold text-lg mb-4">Payment Status</h3>
              <p className="text-sm text-gray-300">No live payment provider is configured. A request remains pending until a verified provider integration confirms receipt of funds.</p>
            </div>
            <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6">
              <h3 className="text-white font-bold text-lg mb-4">Responsible Gaming</h3>
              <p className="text-sm text-gray-300 mb-4">Set deposit limits and spending controls before using any real-money service.</p>
              <Link href="/dashboard" className="text-yellow-400 hover:text-yellow-300 text-sm font-medium">Manage Limits →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
