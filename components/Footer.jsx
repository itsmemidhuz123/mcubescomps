'use client'

import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Twitter, Instagram, Youtube, Linkedin, Github } from 'lucide-react';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    const footerLinks = {
        product: [
            { name: 'Competitions', href: '/competitions' },
            { name: 'Leaderboard', href: '/rankings' },
            { name: 'Timer', href: '/timer' },
            { name: 'Events', href: '/competitions' }
        ],
        company: [
            { name: 'About', href: '/about' },
            { name: 'Contact', href: '/contact' },
            { name: 'Blog', href: '/blog' },
            { name: 'Careers', href: '/careers' }
        ],
        resources: [
            { name: 'Help Center', href: '/help' },
            { name: 'Tutorials', href: '/tutorials' },
            { name: 'FAQ', href: '/faq' },
            { name: 'Support', href: '/support' }
        ],
        legal: [
            { name: 'Privacy Policy', href: '/privacy' },
            { name: 'Terms of Service', href: '/terms' },
            { name: 'Cookie Policy', href: '/cookies' },
            { name: 'Guidelines', href: '/guidelines' }
        ]
    };

    const socialLinks = [
        { name: 'Facebook', icon: Facebook, href: 'https://facebook.com' },
        { name: 'Twitter', icon: Twitter, href: 'https://twitter.com' },
        { name: 'Instagram', icon: Instagram, href: 'https://instagram.com' },
        { name: 'YouTube', icon: Youtube, href: 'https://youtube.com' },
        { name: 'LinkedIn', icon: Linkedin, href: 'https://linkedin.com' },
        { name: 'GitHub', icon: Github, href: 'https://github.com' }
    ];

    return (
        <footer className="bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">

                    {/* Brand Section */}
                    <div className="col-span-2 md:col-span-3 lg:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 relative">
                                <Image
                                    src="https://themcubes.in/wp-content/uploads/2025/12/app_icon.jpg"
                                    alt="MCUBES"
                                    fill
                                    className="rounded-lg object-cover"
                                />
                            </div>
                            <span className="text-xl font-bold text-zinc-900 dark:text-white">MCUBES</span>
                        </div>
                        <p className="text-sm text-zinc-700 dark:text-zinc-200 mb-6 max-w-xs">
                            The ultimate platform for speedcubers to compete, track progress, and connect with the global cubing community.
                        </p>
                        <div className="flex gap-3">
                            {socialLinks.map((social) => {
                                const Icon = social.icon;
                                return (
                                    <Link
                                        key={social.name}
                                        href={social.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-9 w-9 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors"
                                        aria-label={social.name}
                                    >
                                        <Icon className="h-4 w-4 text-zinc-700 dark:text-zinc-200" />
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h3 className="font-semibold text-sm text-zinc-900 dark:text-white mb-4">Product</h3>
                        <ul className="space-y-3">
                            {footerLinks.product.map((link) => (
                                <li key={link.name}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div>
                        <h3 className="font-semibold text-sm text-zinc-900 dark:text-white mb-4">Company</h3>
                        <ul className="space-y-3">
                            {footerLinks.company.map((link) => (
                                <li key={link.name}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Resources Links */}
                    <div>
                        <h3 className="font-semibold text-sm text-zinc-900 dark:text-white mb-4">Resources</h3>
                        <ul className="space-y-3">
                            {footerLinks.resources.map((link) => (
                                <li key={link.name}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h3 className="font-semibold text-sm text-zinc-900 dark:text-white mb-4">Legal</h3>
                        <ul className="space-y-3">
                            {footerLinks.legal.map((link) => (
                                <li key={link.name}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-zinc-700 dark:text-zinc-200 text-center md:text-left">
                            © {currentYear} MCUBES. All rights reserved.
                        </p>
                        <div className="flex items-center gap-6">
                            <Link href="/sitemap" className="text-sm text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                                Sitemap
                            </Link>
                            <Link href="/accessibility" className="text-sm text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                                Accessibility
                            </Link>
                            <Link href="/status" className="text-sm text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                                Status
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;