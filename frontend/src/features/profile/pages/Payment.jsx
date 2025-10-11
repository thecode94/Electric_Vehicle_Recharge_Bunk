import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { getBooking, updateBooking } from "../services/bookingService";
import { createPaymentIntent, confirmPayment } from "../services/paymentService";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";

export default function Payment() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const bookingId = searchParams.get('bookingId');

    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [walletBalance, setWalletBalance] = useState(2500.00);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet');
    const [toast, setToast] = useState({ type: "", message: "", open: false });

    const onCloseToast = () => setToast(t => ({ ...t, open: false }));

    useEffect(() => {
        if (!bookingId) {
            setToast({ type: "error", message: "No booking ID provided", open: true });
            setTimeout(() => navigate('/bookings'), 2000);
            return;
        }

        fetchBookingDetails();
    }, [bookingId]);

    const fetchBookingDetails = async () => {
        try {
            setLoading(true);
            const bookingData = await getBooking(bookingId);
            setBooking(bookingData.booking || bookingData);
        } catch (error) {
            setToast({
                type: "error",
                message: "Failed to load booking details",
                open: true
            });
        } finally {
            setLoading(false);
        }
    };

    const handleWalletPayment = async () => {
        if (!booking) return;

        if (walletBalance < booking.amount) {
            setToast({
                type: "error",
                message: "Insufficient wallet balance",
                open: true
            });
            return;
        }

        try {
            setProcessing(true);

            await updateBooking(booking.id, {
                status: 'confirmed',
                paymentStatus: 'paid',
                paymentMethod: 'wallet',
                paidAt: new Date().toISOString()
            });

            setWalletBalance(prev => prev - booking.amount);

            setToast({
                type: "success",
                message: "Payment successful! Booking confirmed.",
                open: true
            });

            setTimeout(() => {
                navigate('/bookings');
            }, 2000);

        } catch (error) {
            setToast({
                type: "error",
                message: "Payment failed. Please try again.",
                open: true
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleCardPayment = async () => {
        try {
            setProcessing(true);

            const paymentIntent = await createPaymentIntent({
                bookingId: booking.id,
                amount: booking.amount,
                currency: 'INR'
            });

            const confirmation = await confirmPayment(paymentIntent.id, {
                paymentMethod: 'card',
                bookingId: booking.id
            });

            if (confirmation.success) {
                await updateBooking(booking.id, {
                    status: 'confirmed',
                    paymentStatus: 'paid',
                    paymentMethod: 'card',
                    paidAt: new Date().toISOString()
                });

                setToast({
                    type: "success",
                    message: "Payment successful! Booking confirmed.",
                    open: true
                });

                setTimeout(() => navigate('/bookings'), 2000);
            }

        } catch (error) {
            setToast({
                type: "error",
                message: "Card payment failed. Please try again.",
                open: true
            });
        } finally {
            setProcessing(false);
        }
    };

    const handlePayment = () => {
        if (selectedPaymentMethod === 'wallet') {
            handleWalletPayment();
        } else {
            handleCardPayment();
        }
    };

    if (loading) {
        return (
            <div className="page page--center">
                <Spinner size={32} />
                <p className="muted">Loading payment details...</p>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="page page--center">
                <h2>Booking not found</h2>
                <button onClick={() => navigate('/bookings')} className="btn btn--primary">
                    Go to Bookings
                </button>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 600, margin: '0 auto' }}>
                <h1>Complete Payment</h1>

                <div className="card" style={{ marginBottom: 24 }}>
                    <h3>Booking Summary</h3>
                    <div className="booking-summary">
                        <div className="summary-row">
                            <span>Booking ID:</span>
                            <span>{booking.id}</span>
                        </div>
                        <div className="summary-row">
                            <span>Duration:</span>
                            <span>{booking.durationMins} minutes</span>
                        </div>
                        <div className="summary-row">
                            <span>Vehicle Type:</span>
                            <span>{booking.vehicleType}</span>
                        </div>
                        <div className="summary-row">
                            <span>Connector Type:</span>
                            <span>{booking.connectorType}</span>
                        </div>
                        <div className="summary-row total">
                            <span><strong>Total Amount:</strong></span>
                            <span><strong>₹{booking.amount}</strong></span>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 24 }}>
                    <h3>Select Payment Method</h3>

                    <div className="payment-methods">
                        <label className="payment-method">
                            <input
                                type="radio"
                                name="paymentMethod"
                                value="wallet"
                                checked={selectedPaymentMethod === 'wallet'}
                                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                            />
                            <div className="payment-method-content">
                                <div className="payment-method-info">
                                    <strong>EV Wallet</strong>
                                    <p>Pay using your EV wallet balance</p>
                                </div>
                                <div className="payment-method-balance">
                                    <span className="balance">Balance: ₹{walletBalance.toFixed(2)}</span>
                                    {walletBalance < booking.amount && (
                                        <span className="insufficient">Insufficient Balance</span>
                                    )}
                                </div>
                            </div>
                        </label>

                        <label className="payment-method">
                            <input
                                type="radio"
                                name="paymentMethod"
                                value="card"
                                checked={selectedPaymentMethod === 'card'}
                                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                            />
                            <div className="payment-method-content">
                                <div className="payment-method-info">
                                    <strong>Credit/Debit Card</strong>
                                    <p>Pay securely with your card</p>
                                </div>
                                <div className="payment-method-icon">💳</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="payment-actions">
                    <button
                        onClick={() => navigate(-1)}
                        className="btn btn--secondary"
                        disabled={processing}
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handlePayment}
                        className="btn btn--primary"
                        disabled={
                            processing ||
                            (selectedPaymentMethod === 'wallet' && walletBalance < booking.amount)
                        }
                        style={{ minWidth: 140 }}
                    >
                        {processing ? (
                            <><Spinner size={16} /> Processing...</>
                        ) : (
                            `Pay ₹${booking.amount}`
                        )}
                    </button>
                </div>
            </div>

            {toast.open && (
                <Toast type={toast.type} onClose={onCloseToast}>
                    {toast.message}
                </Toast>
            )}

            <style jsx>{`
                .booking-summary .summary-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #eee;
                }
                
                .booking-summary .summary-row.total {
                    border-top: 2px solid #ddd;
                    margin-top: 12px;
                    padding-top: 12px;
                    font-size: 1.1em;
                }
                
                .payment-methods {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                
                .payment-method {
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    border: 2px solid #e5e5e5;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .payment-method:hover {
                    border-color: #007bff;
                }
                
                .payment-method input[type="radio"]:checked + .payment-method-content {
                    color: #007bff;
                }
                
                .payment-method input[type="radio"] {
                    margin-right: 12px;
                }
                
                .payment-method-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex: 1;
                }
                
                .payment-method-info p {
                    margin: 4px 0 0 0;
                    color: #666;
                    font-size: 0.9em;
                }
                
                .payment-method-balance {
                    text-align: right;
                }
                
                .balance {
                    font-weight: 600;
                    color: #28a745;
                }
                
                .insufficient {
                    display: block;
                    color: #dc3545;
                    font-size: 0.8em;
                    margin-top: 4px;
                }
                
                .payment-method-icon {
                    font-size: 24px;
                }
                
                .payment-actions {
                    display: flex;
                    gap: 16px;
                    justify-content: flex-end;
                    margin-top: 24px;
                }
                
                .btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }
                
                .btn--primary {
                    background-color: #007bff;
                    color: white;
                }
                
                .btn--primary:hover:not(:disabled) {
                    background-color: #0056b3;
                }
                
                .btn--secondary {
                    background-color: #6c757d;
                    color: white;
                }
                
                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}
