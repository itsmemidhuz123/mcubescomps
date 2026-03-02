'use client'

import Link from 'next/link';
import Image from 'next/image';

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <div className="max-w-4xl mx-auto px-4 py-16">
                <div className="mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Home
                    </Link>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 md:p-12">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-12 w-12 relative">
                            <Image
                                src="https://themcubes.in/wp-content/uploads/2025/12/app_icon.jpg"
                                alt="MCUBES"
                                fill
                                className="rounded-xl object-cover"
                            />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Terms of Service</h1>
                            <p className="text-zinc-500 dark:text-zinc-400">Last updated: February 2026</p>
                        </div>
                    </div>

                    <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                By accessing and using MCUBES (&quot;the Platform&quot;), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">2. Description of Service</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                MCUBES is a speedcubing competition platform that allows users to participate in competitions, track their results, connect with other cubers, and manage their cubing profiles. The Platform provides tools for competition organization, result tracking, and community engagement.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">3. User Accounts</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                To access certain features of the Platform, you must register for an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
                            </p>
                            <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 mt-3 space-y-2">
                                <li>You must provide accurate and complete information during registration</li>
                                <li>You must be at least 13 years old to create an account</li>
                                <li>Each user may only maintain one account at a time</li>
                                <li>Accounts are for individual use only and may not be shared</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">4. User Conduct</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                You agree not to use the Platform for any unlawful purpose or in any way that could damage, disable, overburden, or impair the Platform. Prohibited activities include but are not limited to:
                            </p>
                            <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 mt-3 space-y-2">
                                <li>Submitting false or misleading information</li>
                                <li>Attempting to gain unauthorized access to other users&apos; accounts</li>
                                <li>Using automated systems or software to extract data from the Platform</li>
                                <li>Engaging in harassment, hate speech, or discriminatory behavior</li>
                                <li>Violating any applicable laws or regulations</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">5. Competition Rules</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                Participants in MCUBES competitions must adhere to the official World Cube Association (WCA) regulations where applicable. Competition organizers reserve the right to disqualify participants who violate competition rules or engage in cheating or unsportsmanlike conduct.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">6. Intellectual Property</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                All content, features, and functionality of the Platform, including but not limited to text, graphics, logos, and software, are owned by MCUBES and are protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without express permission.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">7. Limitation of Liability</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                MCUBES shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Platform. In no event shall our liability exceed the amount paid by you for access to the Platform.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">8. Termination</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                We reserve the right to suspend or terminate your account at any time for any reason, including violation of these Terms. Upon termination, your right to use the Platform will immediately cease.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">9. Changes to Terms</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                We may modify these Terms at any time. We will notify users of significant changes via email or through the Platform. Your continued use of the Platform after changes constitutes acceptance of the modified Terms.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">10. Contact Information</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                If you have any questions about these Terms, please contact us at{' '}
                                <a href="mailto:support@themcubes.in" className="text-purple-600 dark:text-purple-400 hover:underline">
                                    support@themcubes.in
                                </a>
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}