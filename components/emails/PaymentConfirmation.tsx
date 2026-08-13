import * as React from 'react';

interface PaymentConfirmationProps {
  bookCode: string;
}

export const PaymentConfirmationEmail = ({ bookCode }: PaymentConfirmationProps) => {
  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f6f8', padding: '40px' }}>
      <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '500px', margin: '0 auto' }}>
        <h1 style={{ color: '#6d28d9', textAlign: 'center' }}>Payment Confirmed — Access Your Portal 🚀</h1>
        <p>Hi there,</p>
        <p>Your payment has been successfully received.</p>
        <p>Here are your details:</p>
        <div style={{ backgroundColor: '#f0f0f0', padding: '15px', borderRadius: '5px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}>
          Book Code: {bookCode}
        </div>
        <p>Use this code to  access the portal and complete your registration for the internship opportunity.</p>
        <p>Once your  registration is complete, your book will be available for access directly on the platform.</p>
        <p><strong>👉 Next Step:</strong></p>
        <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '20px' }}>
          <a href="https://ecosystem.deloxehr.com" style={{ backgroundColor: '#6d28d9', color: '#ffffff', padding: '12px 24px', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold' }}>Access Portal</a>
        </div>
        <p>If you experience any issues, feel free to reach out for support.</p>
        <p>DELOXE HR</p>
      </div>
    </div>
  );
};
