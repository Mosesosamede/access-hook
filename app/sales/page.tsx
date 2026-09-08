import type { Metadata } from 'next';
import Image from 'next/image';
import BuyBook from '@/components/BuyBook';

export const metadata: Metadata = {
  title: 'Get Hired Handbook | Deloxe HR',
  description: 'Master your career with the Get Hired Handbook and fast-track your internship.',
};

export default function SalesHubPage() {
  return (
    <main className="min-h-screen text-[#E0E6ED] p-6 md:p-12 relative">
      {/* Scattered Shapes - copy from layout */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-20">
        <div className="absolute top-[10%] left-[10%] w-64 h-64 bg-[#d9f0dd] rounded-full mix-blend-screen filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[10%] w-96 h-96 bg-[#DFFF00] rounded-full mix-blend-screen filter blur-3xl animate-pulse"></div>
        <div className="absolute top-[50%] left-[30%] w-48 h-48 bg-purple-500 rounded-full mix-blend-screen filter blur-3xl animate-pulse delay-700"></div>
        <div className="absolute bottom-[20%] left-[20%] w-72 h-72 bg-[#dbf0de] rounded-full mix-blend-screen filter blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 flex flex-col md:flex-row-reverse gap-8 md:gap-12 p-6 md:p-12 items-center max-w-5xl mx-auto shadow-2xl">
        <div className="flex-1 w-full text-center md:text-left">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-white">Get Hired Handbook</h1>
          <p className="text-base md:text-xl mb-8">Your ultimate guide to securing your dream internship. Purchase now to receive your unique Access Code and start your internship track.</p>
          <BuyBook />
        </div>
        <div className="flex-none order-first md:order-last">
          <div className="relative perspective-1000">
            <Image 
              src="https://i.ibb.co/KzNwhhj3/getting-hire-got-easier.png"
              alt="Get Hired Handbook"
              width={300}
              height={400}
              className="rounded-xl shadow-2xl transition-transform duration-500 hover:rotate-y-12"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
