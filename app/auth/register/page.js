'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';

const COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
    'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
    'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
    'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Congo Democratic Republic',
    'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'East Timor',
    'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland',
    'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea',
    'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq',
    'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
    'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein',
    'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania',
    'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
    'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia',
    'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines',
    'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa',
    'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
    'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden',
    'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia',
    'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
    'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

function RegisterPage() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        country: '',
        wcaId: ''
    });
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptPrivacy, setAcceptPrivacy] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const router = useRouter();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (!formData.firstName || !formData.lastName) {
            setError('Please enter your full name');
            return;
        }

        if (!formData.country) {
            setError('Please select your country');
            return;
        }

        if (!acceptTerms) {
            setError('You must accept the Terms of Service to continue');
            return;
        }

        if (!acceptPrivacy) {
            setError('You must accept the Privacy Policy to continue');
            return;
        }

        setLoading(true);

        try {
            await signUp(
                formData.email,
                formData.password,
                formData.firstName,
                formData.lastName,
                formData.country,
                formData.wcaId
            );
            router.push('/');
        } catch (error) {
            setError(error.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-white flex">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-4 sm:px-12 lg:px-24 py-12">
                <div className="w-full max-w-md mx-auto space-y-8">

                    {/* Header */}
                    <div className="space-y-2">
                        <div className="h-12 w-12 relative mb-6">
                            <Image
                                src="https://themcubes.in/wp-content/uploads/2025/12/app_icon.jpg"
                                alt="MCUBES"
                                fill
                                className="rounded-xl object-cover"
                            />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Start your journey to becoming a speedcubing champion.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-red-600 dark:text-red-500">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First name</Label>
                                <Input
                                    id="firstName"
                                    name="firstName"
                                    placeholder="John"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    className="bg-white dark:bg-[#1a1a1a] border-zinc-300 dark:border-zinc-800 focus:border-purple-500 h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last name</Label>
                                <Input
                                    id="lastName"
                                    name="lastName"
                                    placeholder="Doe"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    className="bg-white dark:bg-[#1a1a1a] border-zinc-300 dark:border-zinc-800 focus:border-purple-500 h-11"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="bg-white dark:bg-[#1a1a1a] border-zinc-300 dark:border-zinc-800 focus:border-purple-500 h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                                <SelectTrigger className="bg-white dark:bg-[#1a1a1a] border-zinc-300 dark:border-zinc-800 focus:border-purple-500 h-11">
                                    <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-[#1a1a1a] border-zinc-200 dark:border-zinc-800">
                                    {COUNTRIES.map(country => (
                                        <SelectItem key={country} value={country} className="focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-900 dark:focus:text-white">
                                            {country}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="wcaId">WCA ID <span className="text-zinc-500 dark:text-zinc-500 font-normal">(Optional)</span></Label>
                            <Input
                                id="wcaId"
                                name="wcaId"
                                placeholder="e.g. 2019JOHN01"
                                value={formData.wcaId}
                                onChange={handleChange}
                                className="bg-white dark:bg-[#1a1a1a] border-zinc-300 dark:border-zinc-800 focus:border-purple-500 h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="Create a password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="bg-white dark:bg-[#1a1a1a] border-zinc-300 dark:border-zinc-800 focus:border-purple-500 h-11"
                            />
                            <p className="text-xs text-zinc-500">Must be at least 6 characters</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                placeholder="Confirm your password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                className="bg-white dark:bg-[#1a1a1a] border-zinc-300 dark:border-zinc-800 focus:border-purple-500 h-11"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="terms"
                                    checked={acceptTerms}
                                    onCheckedChange={setAcceptTerms}
                                    className="border-zinc-300 dark:border-zinc-600 mt-0.5"
                                />
                                <label htmlFor="terms" className="text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
                                    I agree to the{' '}
                                    <Link href="/terms" target="_blank" className="text-purple-600 dark:text-purple-400 hover:underline">
                                        Terms of Service
                                    </Link>
                                </label>
                            </div>
                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="privacy"
                                    checked={acceptPrivacy}
                                    onCheckedChange={setAcceptPrivacy}
                                    className="border-zinc-300 dark:border-zinc-600 mt-0.5"
                                />
                                <label htmlFor="privacy" className="text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
                                    I agree to the{' '}
                                    <Link href="/privacy" target="_blank" className="text-purple-600 dark:text-purple-400 hover:underline">
                                        Privacy Policy
                                    </Link>
                                </label>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-purple-600 hover:bg-purple-700 h-11 text-base font-medium"
                            disabled={loading}
                        >
                            {loading ? 'Creating account...' : 'Get started'}
                        </Button>
                    </form>

                    {/* Footer */}
                    <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                        Already have an account?{' '}
                        <Link href="/auth/login" className="text-purple-600 dark:text-purple-500 hover:text-purple-500 dark:hover:text-purple-400 font-semibold">
                            Log in
                        </Link>
                    </p>
                </div>
            </div>

            {/* Right Side - Image/Visual */}
            <div className="hidden lg:block lg:w-1/2 relative bg-zinc-100 dark:bg-[#121212]">
                <div className="absolute inset-0">
                    <Image
                        src="https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=2079&auto=format&fit=crop"
                        alt="Cubing Competition"
                        fill
                        className="object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 dark:from-[#0a0a0a] via-zinc-50/50 dark:via-[#0a0a0a]/50 to-transparent" />
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-12 space-y-6">
                    <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                        ))}
                    </div>

                    <h2 className="text-4xl font-bold leading-tight">
                        &quot;MCUBES has completely transformed how I track my progress and compete. The best platform for speedcubers.&quot;
                    </h2>

                    <div className="space-y-1">
                        <p className="font-semibold text-xl">Join 5,000+ Cubers</p>
                        <p className="text-zinc-600 dark:text-zinc-400">Competing daily from over 50 countries</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;