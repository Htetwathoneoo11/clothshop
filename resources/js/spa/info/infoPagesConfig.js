export const infoPages = {
    contact: {
        title: 'Contact',
        intro: 'Need help with an order or product question? Reach out and we will get back to you as soon as possible.',
        sections: [
            {
                heading: 'Customer support',
                body: 'Email: support@clothshop.com - Available Monday to Friday, 9:00 to 17:00.',
            },
            {
                heading: 'Order assistance',
                body: 'Include your order number and the issue details so we can resolve requests faster.',
            },
        ],
    },
    shipping: {
        title: 'Shipping & Delivery',
        intro: 'We prepare and dispatch orders quickly, with delivery windows selected during checkout.',
        sections: [
            {
                heading: 'Processing time',
                body: 'Orders are usually prepared within 1 to 2 business days before dispatch.',
            },
            {
                heading: 'Delivery windows',
                body: 'Your selected delivery date and time are used to prioritize delivery scheduling.',
            },
        ],
    },
    returns: {
        title: 'Returns',
        intro: 'If an item does not fit or arrives with an issue, you can request a return.',
        sections: [
            {
                heading: 'Return window',
                body: 'Return requests should be submitted within 14 days of delivery.',
            },
            {
                heading: 'Item condition',
                body: 'Items must be unworn, unwashed, and returned with original tags where possible.',
            },
        ],
    },
    faq: {
        title: 'FAQ',
        intro: 'Quick answers to common shopping and checkout questions.',
        sections: [
            {
                heading: 'Do I need an account to checkout?',
                body: 'Yes. You need to sign in before adding items to cart and placing an order.',
            },
            {
                heading: 'What payment methods are available?',
                body: 'The app supports cash on delivery, card on delivery, and Stripe sandbox checkout for online test payments.',
            },
        ],
    },
    privacyPolicy: {
        title: 'Privacy Policy',
        intro: 'We collect only the information needed to process orders and provide account features.',
        sections: [
            {
                heading: 'Data we use',
                body: 'Account details, order information, and delivery details are used for purchasing and fulfillment.',
            },
            {
                heading: 'Data protection',
                body: 'We apply access controls and session-based authentication to protect user data.',
            },
        ],
    },
    terms: {
        title: 'Terms of Service',
        intro: 'By using Clothshop, you agree to the platform terms related to orders and account usage.',
        sections: [
            {
                heading: 'Account responsibility',
                body: 'Users are responsible for keeping account credentials secure and accurate.',
            },
            {
                heading: 'Orders and availability',
                body: 'Orders are subject to product availability and successful stock verification at checkout.',
            },
        ],
    },
};
