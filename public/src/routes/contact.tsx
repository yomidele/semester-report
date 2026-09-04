import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatAddress, useCollegeSettings } from "@/lib/college-settings";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact the College" },
      {
        name: "description",
        content: "Contact the college admissions and support team by phone, email or message.",
      },
      { property: "og:title", content: "Contact the College" },
      { property: "og:description", content: "Find college contact details and send an enquiry." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { settings } = useCollegeSettings();
  const [sent, setSent] = useState(false);
  const address = formatAddress(settings);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
    event.currentTarget.reset();
  }

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Contact the College</h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">Questions about admissions, programmes or student services? We are here to help.</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section>
          <h2 className="font-serif text-2xl font-bold text-foreground">Get in touch</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Reach the college through the details below or send a message to the support team.
          </p>
          <dl className="mt-7 space-y-5 text-sm">
            {address && (
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><dt className="font-semibold text-foreground">Address</dt><dd className="mt-1 text-muted-foreground">{address}</dd></div>
              </div>
            )}
            {settings.phone && (
              <div className="flex gap-3">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><dt className="font-semibold text-foreground">Phone</dt><dd className="mt-1 text-muted-foreground">{settings.phone}</dd></div>
              </div>
            )}
            {settings.email && (
              <div className="flex gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><dt className="font-semibold text-foreground">Email</dt><dd className="mt-1 text-muted-foreground">{settings.email}</dd></div>
              </div>
            )}
          </dl>
          <div className="mt-8 flex min-h-48 items-center justify-center border border-dashed border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
            Map location will appear here
          </div>
        </section>

        <Card className="border-border tsu-shadow">
          <CardContent className="p-6">
            <h2 className="font-serif text-2xl font-bold text-primary">Send an enquiry</h2>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium text-foreground">
                  Name
                  <Input name="name" required />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-foreground">
                  Email
                  <Input name="email" type="email" required />
                </label>
              </div>
              <label className="block space-y-1.5 text-sm font-medium text-foreground">
                Phone
                <Input name="phone" type="tel" />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-foreground">
                Message
                <Textarea name="message" required rows={6} />
              </label>
              <Button type="submit"><Send className="mr-2 h-4 w-4" /> Send message</Button>
              {sent && <p role="status" className="text-sm text-primary">Your message has been recorded on this page. We will be in touch through the details provided.</p>}
            </form>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
