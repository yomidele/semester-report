UPDATE public.college_settings
SET college_name = 'Kazaure College of Health Technology',
    short_name = 'KCOHT'
WHERE college_name ILIKE '%shallom%'
   OR college_name ILIKE '%scoe%';