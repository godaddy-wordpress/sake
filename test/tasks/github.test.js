import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getTuesdays, getMonthlyMilestones } from '../../tasks/github.js'

test('getTuesdays returns one entry per Tuesday in the given year', () => {
  const tuesdays = getTuesdays(2024)

  // 2024 is a leap year starting on a Monday, so it has 53 Tuesdays
  assert.equal(tuesdays.length, 53)
  assert.equal(tuesdays.every((t) => t.date.getDay() === 2), true)
  assert.equal(tuesdays.every((t) => t.date.getFullYear() === 2024), true)
})

test('getTuesdays names each milestone with its MM/DD date', () => {
  const [first] = getTuesdays(2024)

  assert.equal(first.name, 'Deploy on 01/02')
})

test('getTuesdays accepts a string year', () => {
  const asString = getTuesdays('2024')
  const asNumber = getTuesdays(2024)

  assert.equal(asString.length, asNumber.length)
  assert.deepEqual(asString[0].name, asNumber[0].name)
})

test('getMonthlyMilestones returns exactly 12 entries for the given year', () => {
  const months = getMonthlyMilestones(2024)

  assert.equal(months.length, 12)
})

test('getMonthlyMilestones dates each milestone on the last day of its month', () => {
  const months = getMonthlyMilestones(2024)

  // January 2024 has 31 days
  assert.equal(months[0].date.getDate(), 31)
  // February 2024 (leap year) has 29 days
  assert.equal(months[1].date.getDate(), 29)
})

test('getMonthlyMilestones names each milestone with its full month and year', () => {
  const months = getMonthlyMilestones(2024)

  assert.equal(months[0].name, 'January 2024')
  assert.equal(months[11].name, 'December 2024')
})
