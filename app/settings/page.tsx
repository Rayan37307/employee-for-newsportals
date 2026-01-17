'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useState } from 'react'
import { SocialSettings } from '@/components/settings/social-settings'
import { ProfileSettings } from '@/components/settings/profile-settings'
import { User, Share2 } from 'lucide-react'

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'profile' | 'social'>('profile')

    return (
        <DashboardLayout>
            <div className="p-8 max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Settings</h1>

                <div className="flex gap-2 mb-8 border-b border-border">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'profile'
                                ? 'border-primary text-primary font-medium'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <User className="w-4 h-4" />
                        Profile
                    </button>
                    <button
                        onClick={() => setActiveTab('social')}
                        className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'social'
                                ? 'border-primary text-primary font-medium'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Share2 className="w-4 h-4" />
                        Social Accounts
                    </button>
                </div>

                <div className="fadeIn">
                    {activeTab === 'profile' && <ProfileSettings />}
                    {activeTab === 'social' && <SocialSettings />}
                </div>
            </div>
        </DashboardLayout>
    )
}
