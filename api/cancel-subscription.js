const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Find customer by email
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });

    if (existingCustomers.data.length === 0) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

    const customer = existingCustomers.data[0];

    // Find active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found for that email address.' });
    }

    const subscription = subscriptions.data[0];

    // Cancel at end of billing period (more user-friendly)
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    const endDate = new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return res.status(200).json({ success: true, endDate });

  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
