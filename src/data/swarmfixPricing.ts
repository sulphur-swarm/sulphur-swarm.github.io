// src/data/swarmfixPricing.ts

export interface PricingTier {
  name: string;
  price: string;
  priceNote?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  featured?: boolean;
}

export const pricingTiers: PricingTier[] = [
  {
    name: 'Community',
    price: 'Free',
    description: 'For open source projects. Start fixing bugs automatically, no cost.',
    features: [
      'Open source projects only',
      'Up to 5 issues / month',
      'Standard queue (24–48 hr)',
      'GitHub Issues integration',
      'Community support',
    ],
    cta: 'Get Started',
    ctaHref: '/contact/',
  },
  {
    name: 'Pro',
    price: '$49',
    priceNote: '/ month',
    description: 'For teams that need speed and unlimited capacity.',
    features: [
      'Any project type',
      'Unlimited issues',
      'Priority queue (< 4 hr)',
      'GitHub, GitLab, Bitbucket',
      'Webhook notifications',
      'Email support',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/contact/',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For organizations with dedicated needs, SLAs, and private repos.',
    features: [
      'Private repositories',
      'Dedicated swarm instances',
      'SLA guarantees',
      'Custom integrations',
      'Dedicated support',
      'On-premise option',
    ],
    cta: 'Contact Us',
    ctaHref: '/contact/',
  },
];
