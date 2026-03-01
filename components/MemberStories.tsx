"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Heart } from "lucide-react";

const memberStories = [
  {
    name: "John M.",
    since: "Member since 1984",
    quote:
      "My wife and I love spending time at our LDMA camps, seeing familiar faces and making new friends. It feels like family every time we pull in.",
    photo: "/images/home/member-john-m.jpg",
  },
  {
    name: "Brandi B.",
    since: "Member since 2006",
    quote:
      "If you haven't experienced an LDMA mining event, you're missing out. The gold, the fun, and the camaraderie is unmatched. We've made memories that will last a lifetime.",
    photo: "/images/home/member-brandi-b.jpg",
  },
  {
    name: "John Shannon",
    since: "LDMA Member",
    quote:
      "When I joined Lost Dutchman's, I went to a few outings, had fun, met a lot of great people, and started planning my stays. Like a little kid, I can't wait to go back every time.",
    photo: "/images/home/member-john-shannon.jpg",
  },
  {
    name: "Paul & Cathy McGillis",
    since: "Long-time Members",
    quote:
      "We laugh when we make our plans to stay at any of our ten 'second' homes. The camps are that special — we've been coming back for years and it never gets old.",
    photo: "/images/home/member-mcgillis.jpg",
  },
];

export function MemberStories() {
  return (
    <motion.section
      className="py-20 md:py-28 bg-[#1a120b]"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.h2
          className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] text-center mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          The Legacy Lives
        </motion.h2>
        <motion.p
          className="text-center text-[#e8e0d5]/80 mb-16 max-w-2xl mx-auto text-lg"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Real stories from real members who&apos;ve been part of the 50-year
          journey
        </motion.p>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-10">
          {memberStories.map((story, i) => (
            <MemberStoryCard key={story.name} story={story} index={i} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function MemberStoryCard({
  story,
  index,
}: {
  story: (typeof memberStories)[0];
  index: number;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.article
      className="group flex flex-col gap-6 bg-[#0f3d1e]/20 rounded-2xl overflow-hidden border border-[#d4af37]/25 hover:border-[#d4af37]/50 p-6 transition-colors duration-300"
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
    >
      {/* Photo - square with rounded corners */}
      <div className="flex-shrink-0 flex justify-center">
        <div className="relative w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] md:aspect-square md:w-full md:max-w-[340px] rounded-xl overflow-hidden bg-[#0f3d1e]/40 mx-auto md:mx-0">
          {!imgError ? (
            <Image
              src={story.photo}
              alt={story.name}
              fill
              className="object-cover object-[50%_25%]"
              sizes="(max-width: 768px) 220px, 400px"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Heart
                className="w-16 h-16 text-[#d4af37]/30"
                strokeWidth={1}
                fill="currentColor"
              />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-2">
          <Heart
            className="w-5 h-5 text-[#d4af37]/70 flex-shrink-0"
            strokeWidth={1.5}
            fill="currentColor"
          />
          <span className="text-[#d4af37] text-sm font-medium">
            {story.since}
          </span>
        </div>
        <h3 className="font-serif text-xl font-semibold text-[#f0d48f] mb-3">
          {story.name}
        </h3>
        <p className="text-[#e8e0d5]/90 text-base leading-relaxed italic font-serif">
          &ldquo;{story.quote}&rdquo;
        </p>
      </div>
    </motion.article>
  );
}
