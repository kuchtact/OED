/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * This code generates select statements for the compressed readings views.
 * @param intervalPrecision
 * @return {string}
 */
function compressedReadingViewSQL(intervalPrecision) {
	const quotedPrecision = `'${intervalPrecision}'`;
	const intervalWidth = `'1 ${intervalPrecision}'::INTERVAL`;
	return `
	SELECT
		r.meter_id AS meter_id,
		-- This gives the weighted average of the reading rates, defined as
		-- sum(reading_rate * overlap_duration) / sum(overlap_duration)
		-- Sum over all readings for this meter.
		(sum(
				 -- Transform the reading from kwh to kw by dividing by the number of hours it took.
				 -- This is the 'reading_rate'.
				 (r.reading / (extract(EPOCH FROM (r.end_timestamp - r.start_timestamp)) / 3600))
				 *
				 -- The number of seconds that the reading shares with the interval. This is the 'overlap_duration'.
				 extract(EPOCH FROM 
				 				 -- If the reading ends before the interval, choose that value. Otherwise choose the
				 				 -- end of the interval.
								 least(r.end_timestamp, gen.interval_start + ${intervalWidth})
								 -
								 -- If the reading starts before the beginning of the interval, choose the beginning of
								 -- the interval. Otherwise choose the start of the reading.
								 greatest(r.start_timestamp, gen.interval_start)
				 )
		 -- Divide by the overlap all readings from this meter have with the full duration.
		 ) / sum( 
		 		 -- The number of seconds that the reading shares with the interval
				 extract(EPOCH FROM 
				 				 -- If the reading ends before the interval, choose that value. Otherwise choose the
				 				 -- end of the interval.
								 least(r.end_timestamp, gen.interval_start + ${intervalWidth})
								 -
								 -- If the reading starts before the beginning of the interval, choose the beginning of
								 -- the interval. Otherwise choose the start of the reading.
								 greatest(r.start_timestamp, gen.interval_start)
				 )
		 )) AS reading_rate,
		-- Insert the time range that was averaged as a column of the table.
		tsrange(gen.interval_start, gen.interval_start + ${intervalWidth}, '()') AS time_interval
	FROM readings r
		-- For each reading create an associated series of intervals.
		-- LATERAL lets us create the interval series for each reading separately.
		CROSS JOIN LATERAL generate_series(
				-- The start of the interval should be the start of the reading rounded down.
				date_trunc(${quotedPrecision}, r.start_timestamp),
				-- The end of the reading is the end of the interval rounded up.
				-- Subtract 1 interval width because generate_series is end-inclusive
				date_trunc_up(${quotedPrecision}, r.end_timestamp) - ${intervalWidth},
				-- Step the series by ${intervalWidth}.
				${intervalWidth}
		) gen(interval_start)
	GROUP BY r.meter_id, gen.interval_start;
	`;
}

/* tslint:disable no-console */
console.log(compressedReadingViewSQL('minute'));
