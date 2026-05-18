-- Update organizer_logo_url to include link targets (imageUrl|linkUrl format)
UPDATE wayfinding_events
SET organizer_logo_url = 'https://static.wixstatic.com/media/e81d2c_b4217595de34451b87dc75433c7f6ebe~mv2.png|https://www.eastsomervillemainstreets.org/event-details/carnaval-2026, https://static.wixstatic.com/media/e81d2c_4f02db12d19d4de581643c20ccf5f624~mv2.png|https://somervilleartscouncil.org/'
WHERE slug = 'carnaval';
