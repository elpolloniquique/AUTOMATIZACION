-- Actualizar captions de plantillas con datos de contacto El Pollón
-- Ejecutar en Supabase SQL Editor si ya corriste el seed anterior

UPDATE post_templates SET default_caption = '🔥 ¡Oferta familiar imperdible en El Pollón! Pollo a la brasa recién salido del horno.

📱 Haz tu pedido por WhatsApp
👉 https://wa.me/56986925310

🍗 Pollo a la Brasa
🚚 Delivery a Domicilio
📍 Iquique, Alto Hospicio y Arica
⏰ Atención de 11:30 a 23:00 hrs.

🌐 Haz tu pedido aquí:
https://www.el-pollon.cl/' WHERE html_template = 'oferta-familiar';

UPDATE post_templates SET default_caption = '🛵 Delivery rápido y seguro. Tu pollo a la brasa llega caliente a tu puerta.

📱 Haz tu pedido por WhatsApp → https://wa.me/56986925310
📍 Iquique, Alto Hospicio y Arica
⏰ 11:30 a 23:00 hrs
🌐 Pedido online: https://www.el-pollon.cl/' WHERE html_template = 'delivery';

UPDATE post_templates SET default_caption = '💑 Combo para dos: el mejor pollo a la brasa. ¡Comparte y disfruta!

📱 https://wa.me/56986925310
🌐 https://www.el-pollon.cl/
📍 Iquique, Alto Hospicio y Arica' WHERE html_template = 'combo-dos';

UPDATE post_templates SET default_caption = '⭐ Plato estrella: pollo a la brasa El Pollón.

📱 WhatsApp: https://wa.me/56986925310
🌐 https://www.el-pollon.cl/' WHERE html_template = 'producto-destacado';

UPDATE post_templates SET default_caption = '🎉 ¡Fin de semana en El Pollón! Promociones para toda la familia.

📱 https://wa.me/56986925310 · 🌐 https://www.el-pollon.cl/' WHERE html_template = 'promo-fin-semana';

UPDATE branches SET
  phone = '+56 9 8692 5310',
  whatsapp = '+56986925310',
  opening_hours = 'Lun-Dom 11:30 - 23:00'
WHERE name LIKE 'El Pollón%';
