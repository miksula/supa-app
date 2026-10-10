select coalesce(json_agg(t), '[]'::json) as lists
from (select * from "lists") as t;