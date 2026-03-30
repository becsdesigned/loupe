const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentMethodId, email, name } = req.body;

  if (!paymentMethodId || !email || !name) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Create or retrieve customer
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer;

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({ email, name });
    }

    // Attach payment method and set as default
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: process.env.STRIPE_PRICE_ID }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    const paymentIntent = subscription.latest_invoice.payment_intent;

    if (paymentIntent.status === 'requires_action') {
      return res.status(200).json({
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
      });
    }

    if (paymentIntent.status === 'succeeded') {
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Payment failed. Please try again.' });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
