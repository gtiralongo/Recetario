Analiza el video de receta de cocina en la siguiente URL y extrae toda la información necesaria para construir una receta. Devuelve ÚNICAMENTE un snippet de código JSON válido dentro de un bloque markdown ```json ... ```, sin explicaciones ni texto adicional antes o después. El JSON debe seguir exactamente esta estructura:

{
  "title": "string (nombre de la receta)",
  "tags": ["string", "string", ...],
  "time": number (tiempo total en minutos),
  "difficulty": "Fácil | Media | Difícil",
  "isPublic": true | false,
  "image": "string (URL de la imagen más representativa del plato terminado, extraída del video)",
  "video": "string (la misma URL del video proporcionada)",
  "imagePrompt": "string (prompt en inglés para generar la imagen del plato con IA)",
  "ingredients": ["string", "string", ...],
  "instructions": ["string", "string", ...]
}

REGLAS ESTRICTAS PARA CADA CAMPO:

1. title: Nombre claro de la receta en español. Ej: "Tacos al Pastor"

2. tags: Array de categorías en español. Debe priorizar las categorías existentes del sistema si aplican: ["Carnes", "Pastas", "Ensaladas", "Postres", "Otros"]. Puedes agregar tags adicionales descriptivos (ej: ["Pastas", "Italiana", "Tradicional"]). Máximo 5 tags. Si no hay categoría clara, usa ["Otros"].

3. time: Tiempo TOTAL de preparación + cocción en minutos. Número entero. Si el video no especifica tiempo, infiérelo razonablemente. Default sugerido: 30.

4. difficulty: Solo uno de estos tres valores exactos: "Fácil", "Media", "Difícil". Default: "Media".

5. isPublic: true si la receta es un clásico, tradicional o apto para compartir públicamente. false si es muy experimental, personal o dudosa.

6. image: URL de la imagen más representativa del plato terminado. Si puedes extraer un frame del video donde se vea el plato finalizado, usa esa URL. Si no hay disponible, usa "".

7. video: La misma URL del video que recibiste.

8. imagePrompt: Prompt en inglés para generar una imagen del plato con IA, optimizado para servicios como Imagen, DALL-E o Stability. Describe el plato terminado en un plato, con buena iluminación, estilo food photography. Ej: "A top-down shot of a carbonara pasta in a white bowl, golden light, fresh parsley garnish, rustic wooden table, food photography style". Si ya proporcionaste una image URL válida, devuelve "".

9. ingredients: Array de strings, DONDE CADA STRING DEBE USAR EL FORMATO PIPE-DELIMITADO:
   "Nombre del ingrediente|Cantidad|Unidad"

   Ejemplos válidos:
   - "Harina|200|gr"
   - "Huevos|3|unidades"
   - "Sal|al gusto|"
   - "Pimienta|una pizca|"

   Reglas:
   - El nombre del ingrediente en español
   - La cantidad puede ser numérica o texto ("al gusto", "una pizca", "1/2", etc.)
   - La unidad es opcional (puede quedar vacía pero el pipe debe estar: "Sal|al gusto|")
   - Cantidad y unidad separadas por pipe
   - Si son múltiples ingredientes compuestos (ej: "200gr de harina"), normaliza a "Harina|200|gr"
   - NO traduzcas nombres de ingredientes que son más reconocibles en otro idioma si son internacionales
   - Mínimo 2 partes separadas por pipe (nombre y cantidad), máximo 3

10. instructions: Array de strings, donde cada string es UN PASO de la preparación. Numerados pero sin incluir el número en el string. Secuencia clara y completa. En español.

EJEMPLO DE SALIDA ESPERADA:

```json
{
  "title": "Pasta Carbonara Auténtica",
  "tags": ["Pastas", "Italiana", "Tradicional"],
  "time": 25,
  "difficulty": "Media",
  "isPublic": true,
  "image": "https://ejemplo.com/carbonara.jpg",
  "video": "https://youtube.com/watch?v=xyz",
  "imagePrompt": "A top-down shot of a creamy carbonara pasta in a white ceramic bowl, guanciale pieces, grated pecorino, black pepper, warm lighting, wooden table, food photography",
  "ingredients": [
    "Espaguetis|400|gr",
    "Guanciale o panceta|200|gr",
    "Yemas de huevo|4|unidades",
    "Queso pecorino|100|gr",
    "Pimienta negra|al gusto|",
    "Sal|al gusto|"
  ],
  "instructions": [
    "Poner una olla grande con agua abundante a hervir y salar generosamente.",
    "Cortar el guanciale en tiras finas y dorarlo en una sartén sin aceite hasta que esté crocante.",
    "En un bowl, batir las yemas con el queso pecorino rallado y abundante pimienta negra.",
    "Cocer la pasta al dente siguiendo el tiempo del paquete.",
    "Escurrir la pasta reservando un poco de agua de cocción.",
    "Fuera del fuego, mezclar la pasta caliente con la mezcla de huevos y queso, agregando agua de cocción de a poco hasta lograr una crema suave. Agregar el guanciale.",
    "Servir inmediatamente con más queso pecorino y pimienta negra por encima."
  ]
}
```

IMPORTANTE: JSON válido, sin trailing commas. El bloque debe empezar exactamente con ```json y terminar con ```, sin nada más antes ni después.
