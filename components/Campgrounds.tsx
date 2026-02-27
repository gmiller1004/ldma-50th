"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, ArrowRight } from "lucide-react";

const campgrounds = [
  {
    name: "Stanton Campground",
    description:
      "Our flagship facility with full RV hookups, tent sites, and access to some of the richest claims in the region.",
    image:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&h=400&fit=crop&q=80",
    location: "Arizona",
    href: "/campgrounds/stanton",
  },
  {
    name: "Coolidge Camp",
    description:
      "A quieter retreat with excellent dry-washing opportunities and stunning desert vistas.",
    image:
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&h=400&fit=crop&q=80",
    location: "Arizona",
    href: "/campgrounds/coolidge",
  },
  {
    name: "Rye Patch",
    description:
      "Nevada gold country. Prime metal detecting and sluicing with RV and tent accommodations.",
    image:
      "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=600&h=400&fit=crop&q=80",
    location: "Nevada",
    href: "/campgrounds/rye-patch",
  },
  {
    name: "Porterville",
    description:
      "California foothills campground with seasonal streams and rich history.",
    image:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=400&fit=crop&q=80",
    location: "California",
    href: "/campgrounds/porterville",
  },
];

export function Campgrounds() {
  return (
    <section className="py-20 md:py-28 bg-[#0f3d1e]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.h2
          className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] text-center mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Featured Campgrounds
        </motion.h2>
        <motion.p
          className="text-center text-[#e8e0d5]/70 mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Your home base for adventure
        </motion.p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {campgrounds.map((camp, i) => (
            <motion.article
              key={camp.name}
              className="group bg-[#1a120b] rounded-xl overflow-hidden border border-[#d4af37]/20 hover:border-[#d4af37]/50 transition-all"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Link href={camp.href} className="block">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={camp.image}
                    alt={camp.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a120b] via-transparent to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 text-[#d4af37] text-sm">
                    <MapPin className="w-4 h-4" />
                    {camp.location}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-serif text-xl font-semibold text-[#f0d48f] group-hover:text-[#f0d48f]">
                      {camp.name}
                    </h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-[#e8e0d5]/70 text-sm mb-4 line-clamp-3">
                    {camp.description}
                  </p>
                  <span className="inline-flex items-center gap-2 text-[#d4af37] font-medium text-sm group-hover:gap-3 transition-all">
                    Learn More
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
