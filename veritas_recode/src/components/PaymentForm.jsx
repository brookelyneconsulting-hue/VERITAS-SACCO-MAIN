import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Clock, CreditCard } from "lucide-react";
import { useMoney } from "@/lib/useMoney";

export default function PaymentForm({ defaultAmount = 0, defaultPhone = "", onSubmit, submitLabel = "Submit Payment" }) {
  const [amount, setAmount] = useState(defaultAmount);
  const [paymentMethod, setPaymentMethod] = useState("mpesa");
  const [phone, setPhone] = useState(defaultPhone || "");
  const [paymentRef, setPaymentRef] = useState("");
  const [stkSent, setStkSent] = useState(false);
  const [stkPin, setStkPin] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const { symbol } = useMoney();

  const generateRef = () => {
    if (paymentMethod === "mpesa") return paymentRef.trim();
    if (paymentMethod === "stk") return `STK${Date.now().toString().slice(-8)}`;
    if (paymentMethod === "card") {
      const last4 = cardNumber.replace(/\s/g, "").slice(-4);
      return `CARD${last4}${Date.now().toString().slice(-6)}`;
    }
    return "";
  };

  const canSubmit = () => {
    if (!amount) return false;
    if (paymentMethod === "mpesa") return !!paymentRef.trim();
    if (paymentMethod === "stk") return stkSent && !!stkPin.trim();
    if (paymentMethod === "card") return !!cardNumber.trim() && !!cardCvv.trim();
    return false;
  };

  const handleSubmit = () => {
    if (!canSubmit()) return;
    onSubmit({
      amount: Number(amount) || 0,
      payment_method: paymentMethod,
      payment_ref: generateRef(),
      phone_number: phone,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setPaymentMethod("mpesa")}
          className={`p-3 rounded-xl border text-xs font-medium transition-all ${paymentMethod === "mpesa" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          <Smartphone className="w-4 h-4 mx-auto mb-1" /> M-Pesa
        </button>
        <button onClick={() => setPaymentMethod("stk")}
          className={`p-3 rounded-xl border text-xs font-medium transition-all ${paymentMethod === "stk" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          <Smartphone className="w-4 h-4 mx-auto mb-1" /> STK Push
        </button>
        <button onClick={() => setPaymentMethod("card")}
          className={`p-3 rounded-xl border text-xs font-medium transition-all ${paymentMethod === "card" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          <CreditCard className="w-4 h-4 mx-auto mb-1" /> Card
        </button>
      </div>

      <div>
        <Label>Amount ({symbol.trim()})</Label>
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      {paymentMethod === "mpesa" && (
        <>
          <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-800">
            Send to Paybill <strong>522522</strong>, Account: <strong>your member number</strong>, then enter the code below.
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input value={phone} placeholder="e.g. 0712345678" onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>M-Pesa Confirmation Code</Label>
            <Input value={paymentRef} placeholder="e.g. QG7K2P9XAB" onChange={(e) => setPaymentRef(e.target.value)} />
          </div>
        </>
      )}

      {paymentMethod === "stk" && (
        <>
          <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-800">
            Enter your M-Pesa phone number. We'll send an STK push prompt to your phone.
          </div>
          <div>
            <Label>M-Pesa Phone Number</Label>
            <Input value={phone} placeholder="e.g. 0712345678" onChange={(e) => setPhone(e.target.value)} />
          </div>
          {!stkSent ? (
            <Button onClick={() => setStkSent(true)} disabled={!phone.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700">
              <Smartphone className="w-4 h-4 mr-2" /> Send STK Push
            </Button>
          ) : (
            <>
              <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0" />
                STK Push sent to {phone}. Enter your M-Pesa PIN to confirm.
              </div>
              <div>
                <Label>M-Pesa PIN</Label>
                <Input type="password" maxLength={4} value={stkPin}
                  onChange={(e) => setStkPin(e.target.value)} placeholder="••••" />
              </div>
            </>
          )}
        </>
      )}

      {paymentMethod === "card" && (
        <>
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-800">
            Enter your card details. Payment will be processed securely.
          </div>
          <div>
            <Label>Card Number</Label>
            <Input value={cardNumber} placeholder="1234 5678 9012 3456" maxLength={19}
              onChange={(e) => setCardNumber(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Expiry (MM/YY)</Label>
              <Input value={cardExpiry} placeholder="12/27" maxLength={5}
                onChange={(e) => setCardExpiry(e.target.value)} />
            </div>
            <div>
              <Label>CVV</Label>
              <Input type="password" value={cardCvv} placeholder="•••" maxLength={4}
                onChange={(e) => setCardCvv(e.target.value)} />
            </div>
          </div>
        </>
      )}

      {!(paymentMethod === "stk" && !stkSent) && (
        <Button onClick={handleSubmit} disabled={!canSubmit()}
          className="w-full bg-emerald-600 hover:bg-emerald-700">
          {paymentMethod === "stk" ? "Confirm Payment" : paymentMethod === "card" ? "Pay Now" : submitLabel}
        </Button>
      )}
    </div>
  );
}