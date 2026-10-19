import { Link } from "wouter";
import { Leaf, ArrowLeft } from "lucide-react";
import { PublicFeedbackLink } from "@/components/PublicFeedbackLink";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-serif font-bold text-emerald-700">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
              <Leaf className="h-4 w-4" />
            </div>
            Clover
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="prose prose-gray max-w-none">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mb-10">Last updated: June 25, 2026</p>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Introduction</h2>
            <p className="text-gray-600 leading-relaxed">
              Welcome to Clover ("we," "us," or "our"). We are committed to protecting your personal
              information and your right to privacy. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you use our application and services (collectively, the "Service").
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              Please read this policy carefully. If you disagree with its terms, please discontinue use of the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Information We Collect</h2>
            <p className="text-gray-600 leading-relaxed mb-3">We collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li><strong>Account information:</strong> name and email address provided through GitHub OAuth authentication.</li>
              <li><strong>Health and nutrition data:</strong> food logs, dietary preferences, allergies, health conditions, age, and weight that you voluntarily enter.</li>
              <li><strong>Voice input:</strong> audio recordings you submit for food logging are transcribed and immediately discarded; we do not store raw audio.</li>
              <li><strong>Feedback:</strong> any feedback, ratings, or messages you submit through the in-app feedback form.</li>
              <li><strong>Payment information:</strong> billing details are processed directly by Stripe and are never stored on our servers.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. How We Use Your Information</h2>
            <p className="text-gray-600 leading-relaxed mb-3">We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Provide, operate, and improve the Service.</li>
              <li>Personalize your nutrition recommendations and AI-generated insights.</li>
              <li>Process payments and manage your subscription.</li>
              <li>Send you service-related communications (e.g., subscription confirmations).</li>
              <li>Respond to your comments, questions, and feedback.</li>
              <li>Monitor and analyze usage patterns to improve user experience.</li>
              <li>Detect and prevent fraudulent or unauthorized activity.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Sharing of Information</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              We do not sell, trade, or rent your personal information to third parties. We may share information with:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li><strong>Service providers:</strong> third-party vendors who assist in operating the Service (e.g., Supabase for database, sign-in and photo storage, Railway for hosting, Stripe for payments, Edamam for recipe data), subject to confidentiality agreements.</li>
              <li><strong>AI providers:</strong> to analyze meals and answer your questions, we send the AI provider (Anthropic) what you type or say in the chat, meal photos you upload, and relevant context from your account such as recent food logs, nutrient estimates, mood check-ins and your health profile (age, weight, dietary choices, allergies and health conditions, if you entered them). Your name and email address are not included. The provider does not use this data to train its models.</li>
              <li><strong>Legal requirements:</strong> we may disclose information if required by law or in response to valid legal process.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Data Retention</h2>
            <p className="text-gray-600 leading-relaxed">
              We retain your personal data for as long as your account is active or as needed to provide the Service.
              You can delete your account and associated data at any time from Settings → Delete account in the app.
              This immediately and permanently removes your profile, meal logs, photos and mood check-ins, and cancels
              any paid subscription. You may also request deletion by contacting us, and we will respond within 30 days.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Security</h2>
            <p className="text-gray-600 leading-relaxed">
              We implement industry-standard security measures including encrypted connections (TLS), hashed session
              tokens, and access controls to protect your information. However, no method of transmission over the
              internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Your Rights</h2>
            <p className="text-gray-600 leading-relaxed mb-3">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate or incomplete data.</li>
              <li>Request deletion of your data ("right to be forgotten").</li>
              <li>Object to or restrict certain processing of your data.</li>
              <li>Data portability — receive a copy of your data in a structured format.</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-3">
              To exercise any of these rights, please contact us at the address below.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Children's Privacy</h2>
            <p className="text-gray-600 leading-relaxed">
              The Service is not directed to individuals under the age of 13. We do not knowingly collect personal
              information from children. If you become aware that a child has provided us with personal information,
              please contact us immediately.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Changes to This Policy</h2>
            <p className="text-gray-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by
              posting the new policy on this page and updating the "Last updated" date. Your continued use of the
              Service after any changes constitutes your acceptance of the new policy.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Contact Us</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg text-gray-600 text-sm">
              <p className="font-medium">Clover</p>
              <p className="mt-1">Email: privacy@cloverwellness.app</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span>© {new Date().getFullYear()} Clover. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors font-medium text-gray-600">Privacy Policy</Link>
            <Link href="/tos" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
            <PublicFeedbackLink className="hover:text-gray-600 transition-colors" />
          </div>
        </div>
      </footer>
    </div>
  );
}
