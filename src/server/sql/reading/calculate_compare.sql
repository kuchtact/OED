/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*

	The compare chart needs three pieces of raw information for each meter:

	1. How much was used during this time period?
	2. How much was used during the previous time period?
	3. How much was used up to this point in the previous time period
 */

/*
This function compares the energy use between two periods of time.
This shouldn't ever be looking at more than a few weeks of data, so we don't need to deal with compression.
 */
CREATE FUNCTION compare_readings(
	meter_ids INTEGER[],
	current_period_start TIMESTAMP,
	current_period_end TIMESTAMP,
	period_duration INTERVAL
)
	RETURNS TABLE(meter_id INTEGER, current_use REAL, prev_use_total REAL, prev_use_for_current REAL)
AS $$
DECLARE
	prev_period_start TIMESTAMP;
	-- How far into the current period we are.
	curr_period_duration INTERVAL;
	prev_period_partial_end TIMESTAMP;
BEGIN
	curr_period_duration := current_period_end - current_period_start;
	-- Throw an error if the time between the start and end of the current period is greater than the specified period duration.
	-- If this is allowed then there will be overlap between the two periods to be compared.
	ASSERT curr_period_duration <= period_duration, 'Current period is too long';
	prev_period_start := current_period_start - period_duration;
	prev_period_partial_end := prev_period_start + curr_period_duration;

	RETURN QUERY
	WITH
		-- TODO: Maybe these should include the crossover readings just lower weighted.
    current_period AS (
      SELECT
        m.id AS meter_id,
        SUM(r.reading) AS reading
      FROM readings r
        -- Select only readings from the specified meters.
        INNER JOIN unnest(meter_ids) m(id) ON r.meter_id = m.id
			-- Select only readings who start and end in the current time period.
      WHERE r.start_timestamp >= current_period_start AND r.end_timestamp <= current_period_end
      GROUP BY m.id
    ),
    prev_period AS (
      SELECT
        m.id AS meter_id,
        SUM(r.reading) AS reading
      FROM readings r
				-- Select only readings from the specified meters.
        INNER JOIN unnest(meter_ids) m(id) ON r.meter_id = m.id
			-- Select only readings who start and end in the previous time period.
			-- prev_end == curr_start TODO: THIS IS INCORRECT. This is only the case when curr_period_duration = period_duration
      WHERE r.start_timestamp >= prev_period_start AND r.end_timestamp <= current_period_start
      GROUP BY m.id
    ),
    prev_period_partial AS (
      SELECT
        m.id AS meter_id,
        SUM(r.reading) AS reading
      FROM readings r
				-- Select only readings from the specified meters.
        INNER JOIN unnest(meter_ids) m(id) ON r.meter_id = m.id
			-- Select only readings who start in the previous time period and end at some point in the previous time period.
      WHERE r.start_timestamp >= prev_period_start AND r.end_timestamp <= prev_period_partial_end
      GROUP BY m.id
    )
	-- Create a row for each meter containing the ncecessary information. If it does not exist, enter null instead.
	SELECT
		m.id AS meter_id,
		current_period.reading::REAL AS current_use,
		prev_period.reading::REAL AS prev_use_total,
		prev_period_partial.reading::REAL AS prev_use_for_current
	FROM
		unnest(meter_ids) m(id)
		-- Left joins here so we get nulls instead of missing rows if readings don't exist for some time intervals
		LEFT JOIN prev_period ON m.id = prev_period.meter_id
		LEFT JOIN prev_period_partial ON m.id = prev_period_partial.meter_id
		LEFT JOIN current_period ON m.id = current_period.meter_id;
END;
$$ LANGUAGE 'plpgsql';


/*
This function compares readings between two groups of readings.
 */
CREATE FUNCTION group_compare_readings(
	group_ids INTEGER[],
	current_period_start TIMESTAMP,
	current_period_end TIMESTAMP,
	period_duration INTERVAL
)
	RETURNS TABLE(group_id INTEGER, current_use REAL, prev_use_total REAL, prev_use_for_current REAL)
AS $$
DECLARE
	meter_ids INTEGER[];
BEGIN
	-- First get all the meter ids that will be included in one or more groups being queried
	SELECT array_agg(DISTINCT meter_id) INTO meter_ids
	FROM unnest(group_ids) gids(id)
	INNER JOIN groups_deep_meters gdm ON gdm.group_id = gids.id;

	RETURN QUERY
	SELECT
		gids.id AS group_id,
		-- Sum uses of all readings for meters in that group.
		SUM(cr.current_use) AS current_use,
		SUM(cr.prev_use_total) AS prev_use_total,
		SUM(cr.prev_use_for_current) AS prev_use_for_current
	FROM unnest(group_ids) gids(id)
    INNER JOIN groups_deep_meters gdm ON gdm.group_id = gids.id
		-- Select compared readings that are from meters in the group.
    INNER JOIN compare_readings(meter_ids, current_period_start, current_period_end, period_duration) cr
        ON cr.meter_id = gdm.meter_id
	GROUP by gids.id;
END;
$$ LANGUAGE 'plpgsql'
