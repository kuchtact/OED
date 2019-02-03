/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const express = require('express');
const validate = require('jsonschema').validate;
const moment = require('moment');

const Reading = require('../models/Reading');

/**
 * Checks if compared meter readings are valid.
 * @param params
 * @returns {boolean}
 */
function validateMeterCompareReadingsParams(params) {
	const validParams = {
		type: 'object',
		maxProperties: 1,
		required: ['meter_ids'],
		properties: {
			meter_ids: {
				type: 'string',
				pattern: '^\\d+(?:,\\d+)*$' // Matches 1 or 1,2 or 1,2,34 (for example)
			}
		}
	};
	const paramsValidationResult = validate(params, validParams);
	return paramsValidationResult.valid;
}

/**
 * Checks if group compared meter readings are valid.
 * @param params
 * @returns {boolean}
 */
function validateGroupCompareReadingsParams(params) {
	const validParams = {
		type: 'object',
		maxProperties: 1,
		required: ['group_ids'],
		properties: {
			group_ids: {
				type: 'string',
				pattern: '^\\d+(?:,\\d+)*$' // Matches 1 or 1,2 or 1,2,34 (for example)
			}
		}
	};
	const paramsValidationResult = validate(params, validParams);
	return paramsValidationResult.valid;
}

/**
 * Checks if if query parameters are valid.
 * @param queryParams
 * @returns {boolean}
 */
function validateQueryParams(queryParams) {
	const validParams = {
		type: 'object',
		maxProperties: 3,
		required: ['curr_start', 'curr_end', 'duration'],
		properties: {
			curr_start: {
				type: 'string' // iso 8601
			},
			'curr_end': {
				type: 'string' // iso 8601
			},
			'duration': {
				type: 'string' // iso 8601 duration
			}
		}
	};
	const paramsValidationResult = validate(queryParams, validParams);
	return paramsValidationResult.valid;
}

/**
 * Returns a Promise of compared meter readings.
 * @param meterIDs
 * @param currStart
 * @param currEnd
 * @param duration
 * @returns {Promise<void>}
 */
async function meterCompareReadings(meterIDs, currStart, currEnd, duration) {
	return await Reading.getCompareReadings(meterIDs, currStart, currEnd, duration);
}

/**
 * Returns a Promise of a group of compared meter readings.
 * @param groupIDs
 * @param currStart
 * @param currEnd
 * @param duration
 * @returns {Promise<*>}
 */
async function groupCompareReadings(groupIDs, currStart, currEnd, duration) {
	return await Reading.getGroupCompareReadings(groupIDs, currStart, currEnd, duration);
}

// TODO: I'm a little confused about what exactly Router is...
/**
 *
 * @returns {Router|router}
 */
function createRouter() {
	const router = express.Router();

	router.get('/meters/:meter_ids', async (req, res) => {
		if (!(validateMeterCompareReadingsParams(req.params) && validateQueryParams(req.query))) {
			res.sendStatus(400);
			return;
		}
		const meterIDs = req.params.meter_ids.split(',').map(id => parseInt(id));
		const currStart = moment(req.query.curr_start);
		const currEnd = moment(req.query.curr_end);
		const duration = moment.duration(req.query.duration);
		res.json(await meterCompareReadings(meterIDs, currStart, currEnd, duration));
	});

	router.get('/groups/:group_ids', async (req, res) => {
		if (!(validateGroupCompareReadingsParams(req.params) && validateQueryParams(req.query))) {
			res.sendStatus(400);
			return;
		}
		const groupIDs = req.params.group_ids.split(',').map(id => parseInt(id));
		const currStart = moment(req.query.curr_start);
		const currEnd = moment(req.query.curr_end);
		const duration = moment.duration(req.query.duration);
		res.json(await groupCompareReadings(groupIDs, currStart, currEnd, duration));
	});

	return router;
}

module.exports = { createRouter };
