import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PRINTFUL_API_KEY = Deno.env.get('PRINTFUL_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const STICKER_PRINT_FILE_URL =
  'https://gogreenstreets.org/assets/print/shift-sticker-final-PRINT.pdf'

// Kiss-Cut Vinyl Decals, Satin, 3"x4" (Printful catalog product 974)
const STICKER_VARIANT_ID = 24971

interface StickerOrderRequest {
  partner_id: string
  business_name: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  zip: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: StickerOrderRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { partner_id, business_name, address_line1, address_line2, city, state, zip } = body

  if (!partner_id || !business_name || !address_line1 || !city || !state || !zip) {
    return new Response(JSON.stringify({ error: 'Missing required address fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const printfulOrder = {
    external_id: `shift-sticker-${partner_id}`,
    shipping: 'STANDARD',
    recipient: {
      name: business_name,
      address1: address_line1,
      address2: address_line2 || '',
      zip,
      city,
      state_code: state,
      country_code: 'US',
    },
    items: [
      {
        external_id: `sticker-item-${partner_id}`,
        variant_id: STICKER_VARIANT_ID,
        quantity: 1,
        files: [
          {
            type: 'default',
            url: STICKER_PRINT_FILE_URL,
          },
        ],
      },
    ],
  }

  try {
    const res = await fetch('https://api.printful.com/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PRINTFUL_API_KEY}`,
      },
      body: JSON.stringify(printfulOrder),
    })

    const data = await res.json()

    if (!res.ok) {
      // Check for duplicate external_id — treat as success (order already exists)
      const errorMsg = JSON.stringify(data)
      if (res.status === 400 && errorMsg.includes('external_id')) {
        console.log(`Duplicate order for partner ${partner_id} — treating as success`)
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      console.error(`Printful API error for partner ${partner_id}:`, data)

      await supabase
        .from('sponsors')
        .update({
          printful_order_status: 'error',
          printful_order_id: null,
        })
        .eq('id', partner_id)

      return new Response(JSON.stringify({ error: 'Printful order failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Success — write order ID and status back
    const orderId = data.result?.id?.toString() || data.id?.toString() || null
    await supabase
      .from('sponsors')
      .update({
        printful_order_id: orderId,
        printful_order_status: 'pending',
      })
      .eq('id', partner_id)

    console.log(`Sticker order placed for partner ${partner_id}: order ${orderId}`)

    return new Response(JSON.stringify({ ok: true, order_id: orderId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(`Unexpected error for partner ${partner_id}:`, err)

    await supabase
      .from('sponsors')
      .update({
        printful_order_status: 'error',
        printful_order_id: null,
      })
      .eq('id', partner_id)

    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
