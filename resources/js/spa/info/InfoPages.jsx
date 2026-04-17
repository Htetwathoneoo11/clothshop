import React from 'react';
import { infoPages } from './infoPagesConfig.js';

function InfoPage({ title, intro, sections }) {
    return (
        <div className="info-page">
            <header className="info-page-header">
                <h1 className="info-page-title">{title}</h1>
                <p className="info-page-intro">{intro}</p>
            </header>
            <div className="info-page-sections">
                {sections.map((section) => (
                    <section key={section.heading} className="info-page-card">
                        <h2>{section.heading}</h2>
                        <p>{section.body}</p>
                    </section>
                ))}
            </div>
        </div>
    );
}

export function ContactPage() {
    return <InfoPage {...infoPages.contact} />;
}

export function ShippingPage() {
    return <InfoPage {...infoPages.shipping} />;
}

export function ReturnsPage() {
    return <InfoPage {...infoPages.returns} />;
}

export function FaqPage() {
    return <InfoPage {...infoPages.faq} />;
}

export function PrivacyPolicyPage() {
    return <InfoPage {...infoPages.privacyPolicy} />;
}

export function TermsPage() {
    return <InfoPage {...infoPages.terms} />;
}
