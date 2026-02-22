'use client'

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, Trophy, CreditCard, User, Award, TrendingUp, LogOut, Shield, MapPin, Calendar, Hash, Crown, LayoutDashboard, Settings, Activity, Sparkles, Camera, Loader2, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getEventName } from '@/lib/wcaEvents';
import EventIcon from '@/lib/EventIcon';
import Link from 'next/link';
import { VerificationSection } from '@/components/verification/VerificationSection';
import { VerifiedBadge } from '@/components/verification/VerifiedBadge';

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

function CompactStat({ icon: Icon, label, value, colorClass }) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5">
            <div className={`p-2 rounded-md bg-opacity-10 ${colorClass.bg}`}>
                <Icon className={`w-4 h-4 ${colorClass.text}`} />
            </div>
            <div>
                <p className="text-lg font-bold text-zinc-900 dark:text-white leading-none">{value}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{label}</p>
            </div>
        </div>
    );
}

function ProfilePage() {
    const { user, userProfile, loading, updateProfile } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [formData, setFormData] = useState({
        displayName: '',
        username: '',
        country: '',
        wcaId: ''
    });
    const [competitions, setCompetitions] = useState([]);
    const [payments, setPayments] = useState([]);
    const [results, setResults] = useState([]);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const verificationStatus = searchParams.get('verification');
        if (verificationStatus === 'approved') {
            setMessage({ type: 'success', text: 'Identity verification successful!' });
        } else if (verificationStatus === 'declined') {
            setMessage({ type: 'error', text: 'Identity verification was declined. Please try again.' });
        } else if (verificationStatus === 'pending') {
            setMessage({ type: 'warning', text: 'Verification is being processed. Please check back later.' });
        } else if (verificationStatus === 'error') {
            setMessage({ type: 'error', text: 'Something went wrong with verification.' });
        }
    }, [searchParams]);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (userProfile) {
            setFormData({
                displayName: userProfile.displayName || '',
                username: userProfile.username || '',
                country: userProfile.country || '',
                wcaId: userProfile.wcaId || ''
            });
            fetchUserData();
        }
    }, [userProfile]);

    async function fetchUserData() {
        if (!user) return;

        try {
            const registrationsQuery = query(
                collection(db, 'registrations'),
                where('userId', '==', user.uid)
            );
            const regSnapshot = await getDocs(registrationsQuery);
            const compIds = regSnapshot.docs.map(doc => doc.data().competitionId);

            const compData = [];
            for (const compId of compIds) {
                try {
                    const compDoc = await getDoc(doc(db, 'competitions', compId));
                    if (compDoc.exists()) {
                        compData.push({ id: compDoc.id, ...compDoc.data() });
                    }
                } catch (e) {
                    console.error('Error fetching competition:', e);
                }
            }
            setCompetitions(compData);

            const paymentsQuery = query(
                collection(db, 'payments'),
                where('userId', '==', user.uid)
            );
            const paymentsSnapshot = await getDocs(paymentsQuery);
            setPayments(paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            const resultsQuery = query(
                collection(db, 'results'),
                where('userId', '==', user.uid)
            );
            const resultsSnapshot = await getDocs(resultsQuery);
            setResults(resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        } catch (error) {
            console.error('Failed to fetch user data:', error);
        } finally {
            setDataLoading(false);
        }
    }

    async function handleSave() {
        if (!user) return;

        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            await updateProfile({
                displayName: formData.displayName,
                username: formData.username,
                country: formData.country,
                wcaId: formData.wcaId
            });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error) {
            console.error('Failed to update profile:', error);
            setMessage({ type: 'error', text: 'Failed to update profile: ' + error.message });
        } finally {
            setSaving(false);
        }
    }

    async function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validation
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            setMessage({ type: 'error', text: 'Invalid file type. Please upload JPG, PNG, or WEBP.' });
            return;
        }

        // Size check (pre-compression)
        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Original file too large. Max 5MB.' });
            return;
        }

        setUploading(true);
        setMessage({ type: '', text: 'Compressing image...' });

        try {
            // Image Compression / Resizing
            const compressedFile = await new Promise((resolve, reject) => {
                const img = new Image();
                img.src = URL.createObjectURL(file);
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Compression failed'));
                            return;
                        }
                        // Create new file from blob
                        const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    }, 'image/jpeg', 0.85); // 85% quality JPEG
                };
                img.onerror = (err) => reject(err);
            });

            setMessage({ type: '', text: 'Uploading...' });

            // 1. Get Presigned URL
            const res = await fetch('/api/upload/profile-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    fileType: compressedFile.type // Changed from contentType to match API expectation
                })
            });

            if (!res.ok) throw new Error('Failed to get upload URL');
            const { uploadUrl, publicUrl } = await res.json(); // Destructure correct fields from API response

            // 2. Upload to S3
            const uploadRes = await fetch(uploadUrl, { // Use uploadUrl from response
                method: 'PUT',
                headers: { 'Content-Type': compressedFile.type },
                body: compressedFile
            });

            if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                throw new Error(`S3 Upload Failed: ${uploadRes.status} ${uploadRes.statusText} - ${errorText}`);
            }

            // 3. Update Profile with new public URL
            // Use the authoritative URL from the server response

            // Update local profile immediately
            await updateProfile({ photoURL: publicUrl });
            setMessage({ type: 'success', text: 'Profile photo updated!' });

        } catch (error) {
            console.error('Upload failed:', error);
            setMessage({ type: 'error', text: 'Failed to upload image: ' + error.message });
        } finally {
            setUploading(false);
        }
    }

    async function handleDeletePhoto() {
        if (!confirm('Are you sure you want to remove your profile photo?')) return;

        setUploading(true);
        try {
            // We don't necessarily need to delete from S3 (it gets overwritten anyway), 
            // but we must remove the reference from the user profile.
            await updateProfile({ photoURL: null });
            setMessage({ type: 'success', text: 'Profile photo removed.' });
        } catch (error) {
            console.error('Remove failed:', error);
            setMessage({ type: 'error', text: 'Failed to remove photo.' });
        } finally {
            setUploading(false);
        }
    }

    const formatTime = (ms) => {
        if (!ms || ms === Infinity || ms === 'DNF') return 'DNF';
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500 border-r-2 border-r-transparent"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-blue-500/30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/10 via-zinc-50 to-zinc-50 dark:from-blue-900/10 dark:via-zinc-950 dark:to-zinc-950 pointer-events-none" />

            <div className="relative z-10">

                <main className="container mx-auto px-4 py-8 max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                        {/* Left Column: Identity & Stats */}
                        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
                            {/* Identity Card */}
                            <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/5 p-6 backdrop-blur-md relative overflow-hidden group">
                                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 opacity-50" />

                                <div className="flex flex-col items-center text-center space-y-4">
                                    <div className="relative group/avatar">
                                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                                        <Avatar className="w-24 h-24 border-4 border-zinc-200 dark:border-black shadow-2xl relative bg-zinc-100 dark:bg-zinc-800">
                                            <AvatarImage src={userProfile?.photoURL} className="object-cover" />
                                            <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-2xl font-bold text-zinc-700 dark:text-white">
                                                {userProfile?.displayName?.[0] || 'U'}
                                            </AvatarFallback>
                                        </Avatar>

                                        {/* Upload / Delete Overlay */}
                                        <div className="absolute -bottom-2 -right-2 flex gap-1">
                                            <label className="cursor-pointer p-2 rounded-full bg-blue-600 hover:bg-blue-500 border-2 border-zinc-100 dark:border-black transition-colors shadow-lg group/btn" title="Upload Photo">
                                                {uploading ? (
                                                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                                                ) : (
                                                    <Camera className="w-4 h-4 text-white" />
                                                )}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    onChange={handleImageUpload}
                                                    disabled={uploading}
                                                />
                                            </label>

                                            {userProfile?.photoURL && (
                                                <button
                                                    onClick={handleDeletePhoto}
                                                    disabled={uploading}
                                                    className="p-2 rounded-full bg-red-600 hover:bg-red-500 border-2 border-zinc-100 dark:border-black transition-colors shadow-lg"
                                                    title="Remove Photo"
                                                >
                                                    <Trash2 className="w-4 h-4 text-white" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{userProfile?.displayName || 'User'}</h1>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm text-zinc-500">@{userProfile?.username || 'username'}</p>
                                            {userProfile?.verificationStatus === 'VERIFIED' && <VerifiedBadge size="sm" />}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                                        {userProfile?.country && (
                                            <Badge variant="outline" className="bg-zinc-100 dark:bg-black/20 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-normal">
                                                <MapPin className="w-3 h-3 mr-1" /> {userProfile.country}
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="bg-zinc-100 dark:bg-black/20 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-normal">
                                            <Calendar className="w-3 h-3 mr-1" /> Joined {new Date(userProfile?.createdAt).getFullYear() || '2024'}
                                        </Badge>
                                    </div>

                                    {userProfile?.wcaId && (
                                        <div className="w-full pt-4 mt-2 border-t border-zinc-200 dark:border-white/5">
                                            <a
                                                href={`https://www.worldcubeassociation.org/persons/${userProfile.wcaId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-500/5 py-2 rounded-md border border-blue-100 dark:border-blue-500/10 hover:border-blue-200 dark:hover:border-blue-500/20"
                                            >
                                                <span className="font-bold font-mono">{userProfile.wcaId}</span>
                                                <div className="w-1 h-1 rounded-full bg-blue-400" />
                                                <span className="text-xs text-zinc-500 uppercase">WCA Profile</span>
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Stats Grid */}
                            <div className="grid grid-cols-1 gap-2">
                                <CompactStat
                                    icon={Trophy}
                                    value={competitions.length}
                                    label="Competitions"
                                    colorClass={{ bg: 'bg-yellow-500', text: 'text-yellow-500' }}
                                />
                                <CompactStat
                                    icon={Crown}
                                    value={results.length}
                                    label="Results"
                                    colorClass={{ bg: 'bg-purple-500', text: 'text-purple-500' }}
                                />
                                <CompactStat
                                    icon={CreditCard}
                                    value={payments.length}
                                    label="Payments"
                                    colorClass={{ bg: 'bg-green-500', text: 'text-green-500' }}
                                />
                            </div>
                        </div>

                        {/* Right Column: Main Content Tabs */}
                        <div className="lg:col-span-8">
                            <Tabs defaultValue="overview" className="w-full">
                                <div className="flex items-center justify-between mb-6">
                                    <TabsList className="bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 p-1 h-auto">
                                        {[
                                            { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
                                            { id: 'results', icon: Activity, label: 'Results' },
                                            { id: 'payments', icon: CreditCard, label: 'History' },
                                            { id: 'edit', icon: Settings, label: 'Settings' }
                                        ].map((tab) => (
                                            <TabsTrigger
                                                key={tab.id}
                                                value={tab.id}
                                                className="data-[state=active]:bg-zinc-200 dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white text-zinc-600 dark:text-zinc-500 px-4 py-2 text-xs font-medium transition-all"
                                            >
                                                <tab.icon className="w-3.5 h-3.5 mr-2" />
                                                {tab.label}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </div>

                                <TabsContent value="overview" className="space-y-4 mt-0 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Welcome Banner */}
                                        <Card className="md:col-span-2 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-zinc-200 dark:border-white/5">
                                            <CardContent className="p-6 flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">Welcome back, {userProfile?.displayName?.split(' ')[0]}!</h3>
                                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">You have {competitions.length} active competitions.</p>
                                                </div>
                                                <div className="hidden sm:flex w-10 h-10 rounded-full bg-blue-500/10 dark:bg-blue-500/10 items-center justify-center">
                                                    <Sparkles className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Verification Section */}
                                        <Card className="md:col-span-2">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                                    <Shield className="w-4 h-4 text-zinc-500" /> Identity Verification
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <VerificationSection />
                                            </CardContent>
                                        </Card>

                                        {/* Recent Activity */}
                                        <Card className="md:col-span-2 bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-white/5">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-zinc-500" /> Recent Competitions
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                {dataLoading ? (
                                                    <div className="text-center py-4 text-xs text-zinc-500">Syncing...</div>
                                                ) : competitions.length === 0 ? (
                                                    <div className="text-center py-8">
                                                        <p className="text-sm text-zinc-500 mb-2">No competitions joined yet</p>
                                                        <Link href="/competitions">
                                                            <Button variant="outline" size="sm" className="h-7 text-xs border-zinc-300 dark:border-white/10 bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white">Explore Events</Button>
                                                        </Link>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {competitions.slice(0, 3).map(comp => (
                                                            <div key={comp.id} className="flex items-center justify-between p-3 rounded-md bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10 transition-colors group">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-1 bg-blue-500 h-8 rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                                                    <div>
                                                                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{comp.name}</p>
                                                                        <p className="text-[10px] text-zinc-500">{comp.city} • {formatDate(comp.startDate)}</p>
                                                                    </div>
                                                                </div>
                                                                <Link href={`/competition/${comp.id}`}>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/5">
                                                                        <Award className="w-4 h-4" />
                                                                    </Button>
                                                                </Link>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                <TabsContent value="results" className="mt-0 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                                    <Card className="bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-white/5">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Competition Results</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {!results.length ? (
                                                <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-white/5 rounded-lg">
                                                    <Trophy className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                                                    <p className="text-sm text-zinc-500">No official results yet.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {results.map(result => (
                                                        <div key={result.id} className="p-4 rounded-lg bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 hover:border-blue-500/20 dark:hover:border-blue-500/20 transition-all group">
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-lg"><EventIcon eventId={result.eventId} size={20} /></span>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{getEventName(result.eventId)}</p>
                                                                        <p className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono">{result.eventId}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-sm font-bold text-zinc-900 dark:text-white font-mono">{formatTime(result.average)}</p>
                                                                    <p className="text-[10px] text-zinc-500">Average</p>
                                                                </div>
                                                            </div>
                                                            <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                                <div className="h-full bg-blue-600/50 w-[70%]" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="payments" className="mt-0 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                                    <Card className="bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-white/5">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Transaction History</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {payments.length === 0 ? (
                                                    <div className="text-center py-8 text-xs text-zinc-500">No transactions found</div>
                                                ) : (
                                                    payments.map(payment => (
                                                        <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-full ${payment.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                                    {payment.status === 'SUCCESS' ? <Shield className="w-3 h-3" /> : <Award className="w-3 h-3" />}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{payment.competitionName || 'Registration'}</p>
                                                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono">{payment.paymentId}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-bold text-zinc-900 dark:text-white">{payment.currency === 'INR' ? '₹' : '$'}{payment.amount}</p>
                                                                <p className="text-[10px] text-zinc-500">{formatDate(payment.createdAt)}</p>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="edit" className="mt-0 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                                    <Card className="bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-white/5">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Profile Settings</CardTitle>
                                            <CardDescription className="text-xs text-zinc-500">Update your public profile information</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {message.text && (
                                                <div className={`p-3 rounded border text-xs flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/20 text-green-600 dark:text-green-400' :
                                                        message.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/20 text-yellow-600 dark:text-yellow-400' :
                                                            'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/20 text-red-600 dark:text-red-400'
                                                    }`}>
                                                    {message.type === 'success' && <CheckCircle className="w-4 h-4" />}
                                                    {message.type === 'warning' && <AlertCircle className="w-4 h-4" />}
                                                    {message.type === 'error' && <XCircle className="w-4 h-4" />}
                                                    {message.text}
                                                </div>
                                            )}

                                            <div className="grid gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-zinc-600 dark:text-zinc-400">Display Name</Label>
                                                    <Input
                                                        value={formData.displayName}
                                                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                                        className="bg-white dark:bg-black/40 border-zinc-300 dark:border-white/10 h-9 text-sm focus:border-blue-500/40 transition-colors"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs text-zinc-600 dark:text-zinc-400">Username</Label>
                                                        <Input
                                                            value={formData.username}
                                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                            className="bg-white dark:bg-black/40 border-zinc-300 dark:border-white/10 h-9 text-sm focus:border-blue-500/40 transition-colors"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs text-zinc-600 dark:text-zinc-400">WCA ID</Label>
                                                        <Input
                                                            value={formData.wcaId}
                                                            onChange={(e) => setFormData({ ...formData, wcaId: e.target.value })}
                                                            className="bg-white dark:bg-black/40 border-zinc-300 dark:border-white/10 h-9 text-sm focus:border-blue-500/40 transition-colors font-mono"
                                                            placeholder="2024ABCD01"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-zinc-600 dark:text-zinc-400">Country</Label>
                                                    <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                                                        <SelectTrigger className="bg-white dark:bg-black/40 border-zinc-300 dark:border-white/10 h-9 text-sm focus:border-blue-500/40">
                                                            <SelectValue placeholder="Select country" />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/10">
                                                            {COUNTRIES.map(country => (
                                                                <SelectItem key={country} value={country} className="focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm">
                                                                    {country}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="bg-zinc-100 dark:bg-blue-900/5 border border-zinc-200 dark:border-blue-900/10 rounded p-3 space-y-1">
                                                    <div className="flex justify-between text-[10px] text-zinc-500 uppercase tracking-wider">
                                                        <span>Account Email</span>
                                                        <span>System ID</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-zinc-700 dark:text-zinc-300 font-mono">
                                                        <span>{userProfile?.email}</span>
                                                        <span>{userProfile?.wcaStyleId}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <Button
                                                    onClick={handleSave}
                                                    disabled={saving}
                                                    size="sm"
                                                    className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 h-8 px-4 text-xs font-medium"
                                                >
                                                    {saving ? 'Saving...' : 'Save Changes'}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

function ProfilePageWithSuspense() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
            <ProfilePage />
        </Suspense>
    );
}

export default ProfilePageWithSuspense;