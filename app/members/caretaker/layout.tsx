export default function CaretakerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-8 xl:px-10">
      {children}
    </div>
  );
}
