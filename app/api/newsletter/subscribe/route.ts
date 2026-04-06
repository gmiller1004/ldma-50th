import { NextResponse } from "next/server";

const KLAVIYO_API_URL = "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/";
const KLAVIYO_REVISION = "2024-05-15";

const SIGNUP_SOURCES = new Set(["home", "events"]);

function normalizeSignupSource(raw: unknown): string {
  if (typeof raw !== "string") return "home";
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return SIGNUP_SOURCES.has(s) ? s : "home";
}

export async function POST(req: Request) {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  const listId = process.env.KLAVIYO_LIST_ID;

  if (!apiKey) {
    console.error("[newsletter] KLAVIYO_PRIVATE_API_KEY not set");
    return NextResponse.json(
      { error: "Newsletter signup is not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const signupSource = normalizeSignupSource(body.signup_source);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    const payload: {
      data: {
        type: string;
        attributes: {
          profiles: { data: unknown[] };
          custom_source?: string;
        };
        relationships?: { list: { data: { type: string; id: string } } };
      };
    } = {
      data: {
        type: "profile-subscription-bulk-create-job",
        attributes: {
          profiles: {
            data: [
              {
                type: "profile",
                attributes: {
                  email,
                  properties: {
                    signup_source: signupSource,
                  },
                  subscriptions: {
                    email: {
                      marketing: {
                        consent: "SUBSCRIBED",
                      },
                    },
                  },
                },
              },
            ],
          },
          custom_source: "LDMA 50th Website",
        },
      },
    };

    if (listId) {
      payload.data.relationships = {
        list: {
          data: {
            type: "list",
            id: listId,
          },
        },
      };
    }

    const res = await fetch(KLAVIYO_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        revision: KLAVIYO_REVISION,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[newsletter] Klaviyo API error:", res.status, errBody);
      if (res.status === 429) {
        return NextResponse.json(
          { error: "Too many requests. Please try again in a moment." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Unable to subscribe. Please try again later." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[newsletter] Subscribe error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
