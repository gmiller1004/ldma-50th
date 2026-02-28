"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Facebook } from "lucide-react";

type Props = {
  url: string;
  campName: string;
};

export function FacebookGroupCTA({ url, campName }: Props) {
  return (
    <motion.section
      className="py-12 md:py-16"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <div className="p-6 md:p-8 rounded-2xl bg-[#0f3d1e]/40 border border-[#d4af37]/20">
          <p className="text-[#e8e0d5]/90 mb-4">
            Connect with {campName} members, share finds, and stay in the loop on
            camp events.
          </p>
          <Link
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1877f2] text-white font-semibold rounded-lg hover:bg-[#166fe5] transition-colors"
          >
            <Facebook className="w-5 h-5" />
            Follow {campName} on Facebook
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
