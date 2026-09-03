import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="orbit-band hidden flex-col justify-between p-10 lg:flex">
        <Link href="/" className="inline-flex" aria-label="Kacific ERP home">
          <Image src="/kacific-logo.png" alt="Kacific" width={175} height={63} priority className="brightness-0 invert" />
        </Link>
        <div className="relative max-w-lg">
          <p className="text-[12px] font-medium uppercase text-cyan">Kacific ERP</p>
          <h1 className="mt-3 text-[44px] font-semibold leading-[1.05]">
            Every terminal.
            <br />
            Every depot.
            <br />
            One procurement flow.
          </h1>
          <p className="mt-5 text-[16px] font-light leading-relaxed text-white/85">
            Purchase orders, vendor invoices, SKU stock and low-stock alerts across the Pacific and South-East Asia
            network — with approvals by email and an AI co-pilot for the routine work.
          </p>
        </div>
        <p className="relative text-[12px] text-white/70">© {new Date().getFullYear()} Kacific Broadband Satellites Group</p>
      </section>
      <section className="flex items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Image src="/kacific-logo.png" alt="Kacific" width={140} height={50} className="mb-8 lg:hidden" />
          {children}
        </div>
      </section>
    </div>
  );
}
