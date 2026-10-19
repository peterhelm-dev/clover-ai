import { Link } from "wouter";
import { Leaf, ArrowLeft } from "lucide-react";
import { PublicFeedbackLink } from "@/components/PublicFeedbackLink";

export default function TermsOfService() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-400 mb-10">Last updated: June 25, 2026</p>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              By accessing or using Clover ("Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms apply to all
              visitors, users, and others who access or use the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Description of Service</h2>
            <p className="text-gray-600 leading-relaxed">
              Clover is an AI-powered nutrition tracking application that allows users to log food intake
              via voice or text, receive AI-generated nutritional analysis, view dietary insights, and access curated
              recipes. The Service is provided for informational and personal wellness purposes only.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3 font-medium">
              The Service is not a substitute for professional medical advice, diagnosis, or treatment. Always seek
              the advice of a qualified healthcare provider with any questions you may have regarding a medical condition.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Accounts and Registration</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              To use certain features of the Service, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Provide accurate, current, and complete information during registration.</li>
              <li>Maintain the security of your account credentials.</li>
              <li>Notify us immediately of any unauthorized use of your account.</li>
              <li>Accept responsibility for all activities that occur under your account.</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-3">
              We reserve the right to suspend or terminate accounts that violate these Terms or that we determine,
              in our sole discretion, are being used in a harmful or abusive manner.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Subscriptions and Billing</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Clover offers free and paid subscription tiers. By subscribing to a paid plan, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Pay all fees associated with your chosen subscription plan.</li>
              <li>Provide valid payment information; all payments are processed by Stripe.</li>
              <li>Automatic renewal of your subscription at the end of each billing period unless cancelled.</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-3">
              You may cancel your subscription at any time through the "Manage Plan" section of the app. Cancellations
              take effect at the end of the current billing period. We do not offer refunds for partial billing periods
              unless required by applicable law.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              Free trial periods, where offered, automatically convert to a paid subscription at the end of the trial
              unless cancelled before the trial expires.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Acceptable Use</h2>
            <p className="text-gray-600 leading-relaxed mb-3">You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Violate any applicable law or regulation.</li>
              <li>Transmit any harmful, offensive, or unlawful content.</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its related systems.</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
              <li>Use automated tools (bots, scrapers) to access the Service without our express written permission.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Intellectual Property</h2>
            <p className="text-gray-600 leading-relaxed">
              The Service and its original content, features, and functionality are and will remain the exclusive
              property of Clover and its licensors. Our trademarks and trade dress may not be used in
              connection with any product or service without our prior written consent.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              You retain ownership of any content you submit to the Service (e.g., food logs, feedback). By submitting
              content, you grant us a non-exclusive, royalty-free license to use, process, and store that content
              solely for the purpose of providing the Service to you.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Disclaimer of Warranties</h2>
            <p className="text-gray-600 leading-relaxed">
              The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either
              express or implied, including but not limited to implied warranties of merchantability, fitness for a
              particular purpose, or non-infringement. We do not warrant that the Service will be uninterrupted,
              error-free, or completely secure.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              Nutritional information generated by the AI is for informational purposes only and may not be accurate.
              We are not responsible for any health decisions made based on information provided by the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Limitation of Liability</h2>
            <p className="text-gray-600 leading-relaxed">
              To the maximum extent permitted by applicable law, Clover shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including but not limited to loss of profits,
              data, or goodwill, arising out of or in connection with your use of the Service, even if we have been
              advised of the possibility of such damages.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              Our total liability to you for any claims arising from these Terms or the Service shall not exceed the
              amount you paid us in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Governing Law</h2>
            <p className="text-gray-600 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the United States,
              without regard to its conflict of law provisions. Any disputes arising under these Terms shall be
              resolved through binding arbitration in accordance with the rules of the American Arbitration Association.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Changes to Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will provide notice of material changes by
              updating the "Last updated" date and, where appropriate, notifying you via email or in-app notification.
              Your continued use of the Service after any changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">11. Contact Us</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have questions about these Terms, please contact us at:
            </p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg text-gray-600 text-sm">
              <p className="font-medium">Clover</p>
              <p className="mt-1">Email: legal@cloverwellness.app</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span>© {new Date().getFullYear()} Clover. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/tos" className="hover:text-gray-600 transition-colors font-medium text-gray-600">Terms of Service</Link>
            <PublicFeedbackLink className="hover:text-gray-600 transition-colors" />
          </div>
        </div>
      </footer>
    </div>
  );
}
