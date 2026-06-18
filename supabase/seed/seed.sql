-- Seed inicial - El Pollón
-- Ejecutar DESPUÉS de crear el usuario super_admin en Supabase Auth
-- Reemplaza 'SUPER_ADMIN_USER_ID' con el UUID real del usuario

-- Sucursales
INSERT INTO branches (id, name, city, address, phone, whatsapp, opening_hours, brand_color, is_active) VALUES
  ('a1111111-1111-1111-1111-111111111101', 'El Pollón Iquique', 'Iquique', 'Vivar 1086, Iquique', '+56 9 8692 5310', '+56986925310', 'Lun-Dom 11:30 - 23:00', '#c50000', true),
  ('a1111111-1111-1111-1111-111111111102', 'El Pollón Alto Hospicio', 'Alto Hospicio', 'Av. Los Condores 567', '+56 9 8692 5310', '+56986925310', 'Lun-Dom 11:30 - 23:00', '#c50000', true),
  ('a1111111-1111-1111-1111-111111111103', 'El Pollón Arica Santa María', 'Arica', 'Av. Santa María 890', '+56 9 8692 5310', '+56986925310', 'Lun-Dom 11:30 - 23:00', '#c50000', true),
  ('a1111111-1111-1111-1111-111111111104', 'El Pollón Arica Saucache', 'Arica', 'Sector Saucache 321', '+56 9 8692 5310', '+56986925310', 'Lun-Dom 11:30 - 23:00', '#c50000', true)
ON CONFLICT (id) DO NOTHING;

-- Bloque de contacto estándar para captions
-- (WhatsApp, web, delivery, ciudades y horario)

-- Plantillas iniciales
INSERT INTO post_templates (name, type, platform, html_template, default_caption, is_active) VALUES
  ('Oferta Familiar', 'oferta', 'all', 'oferta-familiar',
   '🔥 ¡Oferta familiar imperdible en El Pollón! Pollo a la brasa recién salido del horno.

📱 Haz tu pedido por WhatsApp
👉 https://wa.me/56986925310

🍗 Pollo a la Brasa
🚚 Delivery a Domicilio
📍 Iquique, Alto Hospicio y Arica
⏰ Atención de 11:30 a 23:00 hrs.

🌐 Haz tu pedido aquí:
https://www.el-pollon.cl/', true),

  ('Combo para Dos', 'combo', 'all', 'combo-dos',
   '💑 Combo para dos: el mejor pollo a la brasa. ¡Comparte y disfruta! #ElPollon #PolloALaBrasa

📱 https://wa.me/56986925310
🌐 https://www.el-pollon.cl/', true),

  ('Delivery Rápido', 'delivery', 'all', 'delivery',
   '🛵 Delivery rápido y seguro. Tu pollo a la brasa llega caliente a tu puerta.

📱 Haz tu pedido por WhatsApp → https://wa.me/56986925310
📍 Iquique, Alto Hospicio y Arica
🌐 Pedido online: https://www.el-pollon.cl/', true),

  ('Producto Destacado', 'producto_destacado', 'all', 'producto-destacado',
   '⭐ Nuestro plato estrella: pollo a la brasa con papas doradas y ensalada fresca.

📱 WhatsApp: https://wa.me/56986925310
🌐 Web: https://www.el-pollon.cl/', true),

  ('Promoción Fin de Semana', 'promocion', 'all', 'promo-fin-semana',
   '🎉 ¡Fin de semana en El Pollón! Promociones especiales para toda la familia.

📱 https://wa.me/56986925310 · 🌐 https://www.el-pollon.cl/', true),

  ('Testimonio Cliente', 'testimonio', 'all', 'testimonio',
   '💬 Nuestros clientes nos eligen por el sabor auténtico del pollo a la brasa peruano. ¡Gracias por su preferencia!

📱 Pide por WhatsApp: https://wa.me/56986925310', true),

  ('Horario Especial', 'horario', 'all', 'horario',
   '🕐 Te esperamos de 11:30 a 23:00 hrs con el mejor pollo a la brasa.

📍 Iquique, Alto Hospicio y Arica
🌐 https://www.el-pollon.cl/', true),

  ('Fecha Especial', 'fecha_especial', 'all', 'fecha-especial',
   '🎊 Celebra con nosotros. Ofertas especiales en fechas importantes.

📱 https://wa.me/56986925310 · 🌐 https://www.el-pollon.cl/', true)
ON CONFLICT DO NOTHING;

-- Actualizar super_admin (ejecutar manualmente con tu user id):
-- UPDATE profiles SET role = 'super_admin', branch_id = NULL WHERE email = 'admin@elpollon.cl';
