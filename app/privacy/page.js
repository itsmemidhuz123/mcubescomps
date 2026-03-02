'use client'

import Link from 'next/link';
import Image from 'next/image';

export default function PrivacyPolicyPage() {
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
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Privacy Policy</h1>
                            <p className="text-zinc-500 dark:text-zinc-400">Last updated: February 2026</p>
                        </div>
                    </div>

                    <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">1. Information We Collect</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                MCUBES collects information you provide directly to us, including:
                            </p>
                            <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 mt-3 space-y-2">
                                <li><strong>Account Information:</strong> Name, email address, country, and WCA ID (optional)</li>
                                <li><strong>Profile Information:</strong> Display name, profile photo, and bio</li>
                                <li><strong>Competition Data:</strong> Results, times, and participation records</li>
                                <li><strong>Payment Information:</strong> For competition registrations and premium features</li>
                                <li><strong>Communication Data:</strong> Messages and support requests</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">2. How We Use Your Information</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                We use the information we collect to:
                            </p>
                            <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 mt-3 space-y-2">
                                <li>Create and manage your account</li>
                                <li>Process competition registrations and display results</li>
                                <li>Send important updates about competitions and your account</li>
                                <li>Improve our services and develop new features</li>
                                <li>Communicate with you about promotions and events</li>
                                <li>Prevent fraud and maintain platform security</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">3. Information Sharing</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                We do not sell your personal information. We may share your information in the following circumstances:
                            </p>
                            <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 mt-3 space-y-2">
                                <li><strong>Public Results:</strong> Competition results and rankings are publicly displayed</li>
                                <li><strong>Service Providers:</strong> With third parties who perform services on our behalf</li>
                                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">4. Data Security</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">5. Data Retention</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                We retain your information for as long as your account is active or as needed to provide you services. Competition results and public records may be retained indefinitely for historical purposes. You may request deletion of your account, after which we will delete or anonymize your personal information within 30 days.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">6. Cookies and Tracking</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                We use cookies and similar tracking technologies to enhance your experience on our Platform. These help us remember your preferences, analyze usage patterns, and personalize content. You can control cookie settings through your browser preferences.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">7. Your Rights</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                Depending on your location, you may have the following rights:
                            </p>
                            <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 mt-3 space-y-2">
                                <li><strong>Access:</strong> Request a copy of your personal data</li>
                                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                                <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                                <li><strong>Objection:</strong> Object to certain processing of your data</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">8. Children&apos;s Privacy</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                Our Platform is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">9. Third-Party Links</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                Our Platform may contain links to third-party websites. We are not responsible for the privacy practices or content of these external sites. We encourage you to review the privacy policies of any third-party sites you visit.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">10. Changes to This Policy</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. Your continued use of the Platform after changes constitutes acceptance of the updated policy.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">11. Contact Us</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                If you have any questions about this Privacy Policy or our data practices, please contact us at{' '}
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